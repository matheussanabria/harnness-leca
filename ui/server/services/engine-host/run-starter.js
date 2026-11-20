// @ts-check
// Starts a chat run: validates the request, registers the run (chat-run-registry + journal), wires the
// permission cards, the run telemetry and the HIA dispatcher, and launches the engine CLI.
// EP-23.03: runs inside the engine host (ui/engine-host.js). The web server only uses it directly in the
// legacy in-process mode (HARNESS_ENGINE_HOST=0).
const crypto = require("crypto");
const { slugs, MAX_CHATS } = require("../../config");
const E = require("../../../../tools/lib/engines");
const perms = require("../../../../tools/lib/permissions");
const { handleChatWithHia } = require("../hia-chat-dispatcher.service");
const { createChatRunTracker, recordCapacityRejected } = require("../chat-run-telemetry.service");
const { registerRun } = require("../chat-run-registry.service");

let runningChats = 0;

const effortFromTemperature = (t) => (Number(t) <= 0.35 ? "low" : Number(t) >= 0.75 ? "high" : "medium");

/** Engine callbacks that feed the run: chunks, final event and translated errors. */
function sseWriter(run, engineId) {
  return {
    onChunk: (data) => run.push(data),
    onDone: (data) => {
      run.push({ type: "done", ...data });
      run.finish();
    },
    onError: (err) => {
      if (run.finished) return;
      // Erros que reconhecemos (limite, login, rede...) vão traduzidos; o que não reconhecemos vai com um trecho limpo
      // de segredos e caminhos, e só esses ficam inteiros no terminal do servidor.
      const info = E.describeError(err, { engine: engineId });
      if (!info.expected) console.error("[chat]", engineId, (err && err.stack) || err);
      run.push(E.errorEvent(info));
      run.finish();
    },
  };
}

/**
 * @param {Record<string, any>} body the POST /api/chat body
 * @param {{ permissionUrl: string }} options where the Claude permission tool posts its requests
 * @returns {{ status: number, error: string } | { runId: string, run: ReturnType<typeof registerRun> }}
 */
function startChatRun(body, { permissionUrl }) {
  const { engine, prompt, slug, sessionId, history, model, effort, temperature, daiAgent } = body || {};
  const eff = E.safeEffort(effort || (temperature != null ? effortFromTemperature(temperature) : "medium"));
  if (typeof prompt !== "string" || !prompt || !slug) return { status: 400, error: "prompt e slug são obrigatórios" };
  if (!slugs().includes(slug)) return { status: 404, error: "projeto não encontrado" };
  if (MAX_CHATS > 0 && runningChats >= MAX_CHATS) {
    recordCapacityRejected({ slug, engine, running: runningChats, limit: MAX_CHATS, runId: crypto.randomUUID(), traceId: body.traceId });
    return { status: 429, error: `Já há ${MAX_CHATS} respostas em andamento. Aguarde uma terminar.` };
  }

  // The run outlives the HTTP connection (a phone that locks the screen drops the stream): the engine is aborted
  // only on an explicit stop, or when nobody reattaches within the grace period (chat-run-registry.service).
  runningChats++;
  const ac = new AbortController();
  // Pedidos de permissão do motor viram cartões no chat: cada conversa ganha um id que a ferramenta MCP usa para achar este stream.
  const chatId = crypto.randomUUID();
  // T2.2: ciclo de vida da execucao no event log (runId = chatId); so metadados, nunca bloqueia o chat.
  const tracker = createChatRunTracker({ slug, engine, runId: chatId, traceId: body.traceId, model, effort: eff, sessionId });
  const run = registerRun(chatId, {
    meta: { project: slug, engine, chatId },
    abort: () => ac.abort(),
    onEnd: (completed) => {
      runningChats--;
      perms.detachChat(chatId);
      tracker.onClose(completed);
    },
  });

  const sink = sseWriter(run, engine);
  perms.attachChat(chatId, slug, sink.onChunk);
  const tracked = tracker.wrapSink(sink, ac.signal);
  tracker.start();
  run.push({ type: "run", runId: chatId });

  // `override` lets the HIA dispatcher run the turn on another model (a suggested 9Router combo) and observe the
  // result. The observers are best-effort: one that throws must never stop the chat stream or the run tracker.
  const fallbackStream = (override = {}) => {
    const impl = E.engines.get(engine);
    const observe = (fn, data) => { try { fn?.(data); } catch {} };
    const onDone = override.onDone ? (data) => { observe(override.onDone, data); tracked.onDone(data); } : tracked.onDone;
    const onError = override.onError ? (err) => { observe(override.onError, err); tracked.onError(err); } : tracked.onError;
    const onChunk = override.onChunk ? (data) => { observe(override.onChunk, data); tracked.onChunk(data); } : tracked.onChunk;
    if (impl) impl.stream({ prompt, slug, sessionId, history, model: override.model || model, effort: eff, daiAgent, chatId, permissionUrl, signal: ac.signal, ...tracked, onDone, onChunk, onError });
    else tracked.onError(new E.PublicError(`Motor "${engine}" não suportado.`));
  };

  // Modo Shadow do Local AI Runtime: classifica em background sem alterar o motor real nem atrasar a resposta
  try {
    const { interceptShadowRequest } = require("../../../../tools/lib/runtime/shadow");
    interceptShadowRequest({ prompt, slug, actualEngine: engine, correlationId: chatId });
  } catch {}

  // HIA Script-First / Local-First: intercepta automações determinísticas antes de gastar cota
  Promise.resolve(handleChatWithHia({ engine, model, prompt, slug, sessionId, history, signal: ac.signal, sink: tracked, fallbackStream }))
    .catch((err) => tracked.onError(err));

  return { runId: chatId, run };
}

/** Runs still in progress in this process (for /health and the active list). */
const activeRunCount = () => runningChats;

module.exports = { startChatRun, activeRunCount };

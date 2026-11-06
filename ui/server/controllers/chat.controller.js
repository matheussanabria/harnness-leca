// @ts-check
const { slugs, send, readJsonBody, HEADERS, MAX_CHATS } = require("../config");
const E = require("../../../tools/lib/engines");
const DAI = require("../../../tools/lib/dai");
const perms = require("../../../tools/lib/permissions");
const { handleChatWithHia } = require("../services/hia-chat-dispatcher.service");
const { createChatRunTracker, recordCapacityRejected } = require("../services/chat-run-telemetry.service");
const { registerRun, getRun } = require("../services/chat-run-registry.service");
const crypto = require("crypto");

let runningChats = 0;

const effortFromTemperature = (t) => (Number(t) <= 0.35 ? "low" : Number(t) >= 0.75 ? "high" : "medium");

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

const apiEngines = async ({ res }) => send(res, 200, await E.getEnginesStatus());

const apiDai = ({ res }) =>
  send(res, 200, {
    available: !!DAI.getDaiPath(),
    path: DAI.getDaiPath(),
    agents: DAI.listDaiAgents(),
    workflows: DAI.DAI_WORKFLOWS,
  });

async function apiAppPing({ res, url }) {
  const target = url.searchParams.get("url");
  if (!target || !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(target)) {
    return send(res, 400, { error: "URL inválida ou não local" });
  }
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 1000);
    const check = await fetch(target, { method: "HEAD", signal: ac.signal }).catch(() => null);
    clearTimeout(timer);
    return send(res, 200, { alive: !!check, status: check ? check.status : 0 });
  } catch {
    return send(res, 200, { alive: false, status: 0 });
  }
}

async function apiChat({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { engine, prompt, slug, sessionId, history, model, effort, temperature, daiAgent } = body;
  const eff = E.safeEffort(effort || (temperature != null ? effortFromTemperature(temperature) : "medium"));
  if (typeof prompt !== "string" || !prompt || !slug) return send(res, 400, { error: "prompt e slug são obrigatórios" });
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  if (MAX_CHATS > 0 && runningChats >= MAX_CHATS) {
    recordCapacityRejected({ slug, engine, running: runningChats, limit: MAX_CHATS, runId: crypto.randomUUID(), traceId: body.traceId });
    return send(res, 429, { error: `Já há ${MAX_CHATS} respostas em andamento. Aguarde uma terminar.` });
  }

  // The run outlives this connection (a phone that locks the screen drops the stream): the engine is aborted
  // only on an explicit stop, or when nobody reattaches within the grace period (chat-run-registry.service).
  runningChats++;
  const ac = new AbortController();
  // Pedidos de permissão do motor viram cartões no chat: cada conversa ganha um id que a ferramenta MCP usa para achar este stream.
  const chatId = crypto.randomUUID();
  // T2.2: ciclo de vida da execucao no event log (runId = chatId); so metadados, nunca bloqueia o chat.
  const tracker = createChatRunTracker({ slug, engine, runId: chatId, traceId: body.traceId, model, effort: eff, sessionId });
  const run = registerRun(chatId, {
    abort: () => ac.abort(),
    onEnd: (completed) => {
      runningChats--;
      perms.detachChat(chatId);
      tracker.onClose(completed);
    },
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });
  res.flushHeaders?.();
  const sink = sseWriter(run, engine);
  perms.attachChat(chatId, slug, sink.onChunk);
  const permissionUrl = `http://127.0.0.1:${req.socket.localPort}`;
  const tracked = tracker.wrapSink(sink, ac.signal);
  tracker.start();
  run.push({ type: "run", runId: chatId });
  run.attach(res, 0);

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
    const { interceptShadowRequest } = require("../../../tools/lib/runtime/shadow");
    interceptShadowRequest({ prompt, slug, actualEngine: engine, correlationId: chatId });
  } catch {}

  // HIA Script-First / Local-First: intercepta automações determinísticas antes de gastar cota
  Promise.resolve(handleChatWithHia({ engine, model, prompt, slug, sessionId, history, signal: ac.signal, sink: tracked, fallbackStream }))
    .catch((err) => tracked.onError(err));
}

/** GET /api/chat/attach?runId=&from=N: reattaches to a run whose stream was dropped (screen lock, app switch). */
async function apiChatAttach({ res, url }) {
  const run = getRun(url.searchParams.get("runId") || "");
  if (!run) return send(res, 404, { error: "execução não encontrada ou já expirada" });
  const from = Math.max(0, Number(url.searchParams.get("from")) || 0);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });
  res.flushHeaders?.();
  run.attach(res, from);
}

/** POST /api/chat/stop {runId}: the user pressed stop; aborts the engine (a dropped connection no longer does). */
async function apiChatStop({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const run = getRun(String(body.runId || ""));
  if (run) run.stop();
  return send(res, 200, { ok: true, stopped: Boolean(run) });
}

async function apiChatSave({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { slug, engine, title, turns, sessionId } = body;
  if (!slug || !Array.isArray(turns)) return send(res, 400, { error: "slug e turnos são obrigatórios" });
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  try {
    return send(res, 200, { ok: true, ...E.saveChatToProject({ slug, engine, title, turns, sessionId }) });
  } catch (err) {
    console.error("[chat/save]", (err && err.stack) || err);
    return send(res, 500, { error: "Não foi possível salvar a conversa. O detalhe está no terminal do servidor." });
  }
}

/** Routes for reattaching to and stopping a run; spread into the main router table. */
const chatStreamRoutes = [
  { method: "GET", path: "/api/chat/attach", handler: apiChatAttach },
  { method: "POST", path: "/api/chat/stop", handler: apiChatStop },
];

module.exports = {
  apiEngines,
  apiDai,
  apiAppPing,
  apiChat,
  chatStreamRoutes,
  apiChatSave,
};

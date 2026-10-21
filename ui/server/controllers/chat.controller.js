// @ts-check
const { slugs, send, readJsonBody, HEADERS, MAX_CHATS } = require("../config");
const E = require("../../../tools/lib/engines");
const DAI = require("../../../tools/lib/dai");
const perms = require("../../../tools/lib/permissions");
const { handleChatWithHia } = require("../services/hia-chat-dispatcher.service");
const crypto = require("crypto");

let runningChats = 0;

const effortFromTemperature = (t) => (Number(t) <= 0.35 ? "low" : Number(t) >= 0.75 ? "high" : "medium");

function sseWriter(res, engineId) {
  const open = () => !res.writableEnded && !res.destroyed;
  const emit = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* conexão já foi fechada pelo cliente */
    }
  };
  return {
    onChunk: (data) => {
      if (open()) emit(data);
    },
    onDone: (data) => {
      if (open()) {
        emit({ type: "done", ...data });
        res.end();
      }
    },
    onError: (err) => {
      if (!open()) return;
      // Erros que reconhecemos (limite, login, rede...) vão traduzidos; o que não reconhecemos vai com um trecho limpo
      // de segredos e caminhos, e só esses ficam inteiros no terminal do servidor.
      const info = E.describeError(err, { engine: engineId });
      if (!info.expected) console.error("[chat]", engineId, (err && err.stack) || err);
      emit(E.errorEvent(info));
      res.end();
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
  if (runningChats >= MAX_CHATS) return send(res, 429, { error: `Já há ${MAX_CHATS} respostas em andamento. Aguarde uma terminar.` });

  runningChats++;
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) ac.abort();
    runningChats--;
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Content-Type-Options": "nosniff",
    ...HEADERS,
  });
  const sink = sseWriter(res, engine);

  // Pedidos de permissão do motor viram cartões no chat: cada conversa ganha um id que a ferramenta MCP usa para achar este stream.
  const chatId = crypto.randomUUID();
  perms.attachChat(chatId, slug, sink.onChunk);
  res.on("close", () => perms.detachChat(chatId));
  const permissionUrl = `http://127.0.0.1:${req.socket.localPort}`;

  const fallbackStream = () => {
    const impl = E.engines.get(engine);
    if (impl) impl.stream({ prompt, slug, sessionId, history, model, effort: eff, daiAgent, chatId, permissionUrl, signal: ac.signal, ...sink });
    else sink.onError(new E.PublicError(`Motor "${engine}" não suportado.`));
  };

  // Modo Shadow do Local AI Runtime: classifica em background sem alterar o motor real nem atrasar a resposta
  try {
    const { interceptShadowRequest } = require("../../../tools/lib/runtime/shadow");
    interceptShadowRequest({ prompt, slug, actualEngine: engine, correlationId: chatId });
  } catch {}

  // HIA Script-First / Local-First: intercepta automações determinísticas antes de gastar cota
  handleChatWithHia({ engine, prompt, slug, sessionId, history, signal: ac.signal, sink, fallbackStream });
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

module.exports = {
  apiEngines,
  apiDai,
  apiAppPing,
  apiChat,
  apiChatSave,
};

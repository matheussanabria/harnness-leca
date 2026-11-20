// @ts-check
// Chat routes. EP-23.03: the engines run in the engine host (ui/engine-host.js); POST /api/chat, the attach and
// the stop are relayed to it with the same browser contract. HARNESS_ENGINE_HOST=0 keeps the legacy in-process
// mode (the rollback), where this process starts the engines itself.
const { slugs, send, readJsonBody, HEADERS } = require("../config");
const E = require("../../../tools/lib/engines");
const DAI = require("../../../tools/lib/dai");
const { getRun } = require("../services/chat-run-registry.service");
const { startChatRun } = require("../services/engine-host/run-starter");
const { openSse, attachRun } = require("../services/engine-host/sse");
const { isHostMode } = require("../services/engine-host/protocol");
const host = require("../services/engine-host-client");

/** Run ids are UUIDs; anything else never reaches the host URL. */
const RUN_ID = /^[\w-]{1,80}$/;

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

/**
 * Makes sure the engine host is up; answers 503 with a clear message when it is not.
 * @param {import("http").ServerResponse} res @returns {Promise<boolean>}
 */
async function hostReady(res) {
  try {
    await host.ensureHost();
    return true;
  } catch (error) {
    const message = error instanceof host.HostUnavailableError ? error.message : "O host de motores não respondeu.";
    send(res, 503, { error: message });
    return false;
  }
}

/** Relays one request to the host and its answer (SSE or JSON) back to the browser. */
async function relayToHost(res, method, pathname, body) {
  if (!(await hostReady(res))) return;
  try {
    host.relay(await host.hostRequest(method, pathname, body === undefined ? {} : { body }), res, HEADERS);
  } catch {
    if (!res.headersSent) send(res, 503, { error: "O host de motores não respondeu." });
  }
}

async function apiChat({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  if (isHostMode()) return relayToHost(res, "POST", "/runs", body);
  const started = startChatRun(body, { permissionUrl: `http://127.0.0.1:${req.socket.localPort}` });
  if ("error" in started) return send(res, started.status, { error: started.error });
  openSse(res, HEADERS);
  started.run.attach(res, 0);
}

/** GET /api/chat/attach?runId=&from=N: reattaches to a run whose stream was dropped (screen lock, app switch, web restart). */
// EP-23.02: a run no longer in memory is replayed from the journal; 404 only when the run never existed.
async function apiChatAttach({ res, url }) {
  const runId = url.searchParams.get("runId") || "";
  const from = Math.max(0, Number(url.searchParams.get("from")) || 0);
  if (isHostMode()) {
    if (!RUN_ID.test(runId)) return send(res, 404, { error: "execução não encontrada" });
    return relayToHost(res, "GET", `/runs/${runId}/attach?from=${from}`);
  }
  if (!attachRun(res, runId, from, HEADERS)) return send(res, 404, { error: "execução não encontrada" });
}

/** POST /api/chat/stop {runId}: the user pressed stop; aborts the engine (a dropped connection no longer does). */
async function apiChatStop({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const runId = String(body.runId || "");
  if (isHostMode()) {
    if (!RUN_ID.test(runId)) return send(res, 200, { ok: true, stopped: false });
    return relayToHost(res, "POST", `/runs/${runId}/stop`, {});
  }
  const run = getRun(runId);
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
  relayToHost,
};

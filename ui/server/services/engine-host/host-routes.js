// @ts-check
// HTTP routes of the engine host (EP-23.03). Every route needs the host token, except the permission request
// posted by the Claude permission tool (tools/permission-mcp.js), which is accepted from a direct loopback
// connection only, exactly as the web server accepted it before.
const { readJsonBody } = require("../../config");
const perms = require("../../../../tools/lib/permissions");
const { isLocalhostRequest } = require("../../../../tools/lib/network");
const { getRun, listActiveRuns } = require("../chat-run-registry.service");
const { startChatRun, activeRunCount } = require("./run-starter");
const { openSse, attachRun } = require("./sse");
const { PROTOCOL_VERSION, tokenOk } = require("./protocol");

const RUN_PATH = /^\/runs\/([\w-]{1,80})\/(attach|stop)$/;

/** @param {import("http").ServerResponse} res @param {number} status @param {unknown} body */
function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** @param {import("http").IncomingMessage} req */
async function body(req) {
  try {
    return await readJsonBody(req);
  } catch {
    return null;
  }
}

/**
 * @param {{ token: string, version: string, startedAt: string, onShutdown: () => void }} ctx
 * @returns {(req: import("http").IncomingMessage, res: import("http").ServerResponse) => Promise<void>}
 */
function createHostHandler(ctx) {
  return async function handle(req, res) {
    const url = new URL(req.url || "/", "http://host");
    const method = req.method || "GET";
    // The listening socket is loopback-only; this refuses anything relayed by a proxy or tunnel as well.
    if (!isLocalhostRequest(req)) return json(res, 403, { error: "engine host accepts loopback requests only" });

    if (method === "POST" && url.pathname === "/api/permissions/request") {
      const data = await body(req);
      if (!data || typeof data.chatId !== "string" || typeof data.tool !== "string") return json(res, 400, { error: "chatId e tool são obrigatórios" });
      const decision = await perms.request({ chatId: data.chatId, tool: data.tool, input: data.input && typeof data.input === "object" ? data.input : {} });
      return json(res, 200, decision);
    }

    if (!tokenOk(req, ctx.token)) return json(res, 401, { error: "missing or invalid engine host token" });

    if (method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, protocol: PROTOCOL_VERSION, version: ctx.version, pid: process.pid, startedAt: ctx.startedAt, active: activeRunCount() });
    }
    if (method === "GET" && url.pathname === "/runs") return json(res, 200, { runs: listActiveRuns() });
    if (method === "POST" && url.pathname === "/runs") {
      const data = await body(req);
      if (!data) return json(res, 400, { error: "JSON inválido" });
      const port = /** @type {import("net").AddressInfo} */ (req.socket.address()).port;
      const started = startChatRun(data, { permissionUrl: `http://127.0.0.1:${port}` });
      if ("error" in started) return json(res, started.status, { error: started.error });
      openSse(res);
      started.run.attach(res, 0);
      return;
    }
    if (method === "POST" && url.pathname === "/permissions/answer") {
      const data = await body(req);
      if (!data || typeof data.id !== "string") return json(res, 400, { error: "id é obrigatório" });
      const result = perms.answer(data.id, { decision: data.decision, scope: data.scope });
      return json(res, result.ok ? 200 : 404, result);
    }
    if (method === "POST" && url.pathname === "/shutdown") {
      json(res, 200, { ok: true, active: activeRunCount() });
      return ctx.onShutdown();
    }
    const match = RUN_PATH.exec(url.pathname);
    if (match && method === "GET" && match[2] === "attach") {
      const from = Math.max(0, Number(url.searchParams.get("from")) || 0);
      if (!attachRun(res, match[1], from)) return json(res, 404, { error: "execução não encontrada" });
      return;
    }
    if (match && method === "POST" && match[2] === "stop") {
      const run = getRun(match[1]);
      if (run) run.stop();
      return json(res, 200, { ok: true, stopped: Boolean(run) });
    }
    return json(res, 404, { error: "rota desconhecida" });
  };
}

module.exports = { createHostHandler };

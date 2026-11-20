// @ts-check
// Web server side of the engine host (EP-23.03): checks the host, starts it detached when it is down, and relays
// chat requests and SSE streams to it without changing the browser contract.
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { ROOT } = require("../../../tools/lib/root");
const { PROTOCOL_VERSION, TOKEN_HEADER, hostUrl, readToken } = require("./engine-host/protocol");

const HOST_SCRIPT = path.join(__dirname, "..", "..", "engine-host.js");
const START_WAIT_MS = Number(process.env.HARNESS_ENGINE_HOST_START_MS) || 5000;
const POLL_MS = 100;

class HostUnavailableError extends Error {}

/** @type {Promise<void> | null} */
let starting = null;

/**
 * HARNESS_ENGINE_HOST_AUTOSTART=0 turns the automatic start off. Under node --test it is off unless a test sets
 * it to 1: a test hitting /api/chat must never leave a real detached host running.
 */
function autostartAllowed() {
  const flag = process.env.HARNESS_ENGINE_HOST_AUTOSTART;
  if (flag === "0") return false;
  if (process.env.NODE_TEST_CONTEXT) return flag === "1";
  return true;
}

/**
 * Low-level request to the host. Resolves with the response (the caller consumes or pipes it).
 * @param {string} method @param {string} pathname @param {{ body?: unknown, token?: string | null, timeoutMs?: number }} [options]
 * @returns {Promise<http.IncomingMessage>}
 */
function hostRequest(method, pathname, options = {}) {
  const token = options.token === undefined ? readToken() : options.token;
  const target = new URL(pathname, `${hostUrl()}/`);
  const payload = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body));
  return new Promise((resolve, reject) => {
    const req = http.request(target, {
      method,
      headers: {
        ...(token ? { [TOKEN_HEADER]: token } : {}),
        ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
      },
    }, resolve);
    req.on("error", reject);
    if (options.timeoutMs) req.setTimeout(options.timeoutMs, () => req.destroy(new Error("engine host timeout")));
    req.end(payload || undefined);
  });
}

/** @param {http.IncomingMessage} res @returns {Promise<any>} */
function readJson(res) {
  return new Promise((resolve) => {
    let text = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => { text += chunk; });
    res.on("end", () => { try { resolve(JSON.parse(text)); } catch { resolve({}); } });
    res.on("error", () => resolve({}));
  });
}

/** @returns {Promise<{ ok: boolean, protocol?: number, active?: number, pid?: number } | null>} null when unreachable */
async function health() {
  try {
    const res = await hostRequest("GET", "/health", { timeoutMs: 1000 });
    const data = await readJson(res);
    return res.statusCode === 200 ? data : { ok: false, ...data };
  } catch {
    return null;
  }
}

function spawnHost() {
  const logDir = path.join(ROOT, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const log = fs.openSync(path.join(logDir, "engine-host.log"), "a");
  const child = spawn(process.execPath, [HOST_SCRIPT], { detached: true, stdio: ["ignore", log, log], env: process.env, windowsHide: true });
  child.unref();
  fs.closeSync(log);
  console.log(`[engine-host-client] engine host started (pid ${child.pid}); log in logs/engine-host.log`);
}

/** Makes sure a compatible host is up: starts it once when unreachable and waits for /health. */
async function ensureHost() {
  const first = await health();
  if (first?.ok) return checkProtocol(first);
  if (first && !first.ok) throw new HostUnavailableError("O host de motores recusou o token deste servidor. Reinicie o host (npm run host:stop).");
  if (!autostartAllowed()) throw new HostUnavailableError("O host de motores não está no ar. Rode npm run host.");
  if (!starting) {
    starting = (async () => {
      spawnHost();
      const deadline = Date.now() + START_WAIT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const now = await health();
        if (now?.ok) return checkProtocol(now);
      }
      throw new HostUnavailableError("O host de motores não subiu a tempo. Veja logs/engine-host.log.");
    })().finally(() => { starting = null; });
  }
  return starting;
}

/** @param {{ protocol?: number }} info */
function checkProtocol(info) {
  if (info.protocol !== PROTOCOL_VERSION) {
    throw new HostUnavailableError(`O host de motores fala o protocolo ${info.protocol} e este servidor o ${PROTOCOL_VERSION}. Reinicie o host (npm run host:stop).`);
  }
}

/**
 * Relays a host response to the browser: SSE is piped (closing the browser side closes the host connection,
 * which only arms the run's grace period), anything else is copied as JSON.
 * @param {http.IncomingMessage} hostRes @param {import("http").ServerResponse} res @param {Record<string, string>} sseHeaders
 */
function relay(hostRes, res, sseHeaders) {
  const type = String(hostRes.headers["content-type"] || "");
  if (hostRes.statusCode === 200 && type.startsWith("text/event-stream")) {
    res.writeHead(200, { ...sseHeaders, "Content-Type": type, "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Content-Type-Options": "nosniff" });
    res.flushHeaders?.();
    hostRes.pipe(res);
    res.on("close", () => hostRes.destroy());
    return;
  }
  res.writeHead(hostRes.statusCode || 502, { ...sseHeaders, "Content-Type": type || "application/json; charset=utf-8" });
  hostRes.pipe(res);
}

module.exports = { ensureHost, health, hostRequest, readJson, relay, HostUnavailableError };

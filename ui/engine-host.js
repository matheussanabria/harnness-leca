// @ts-check
// Engine host (EP-23.03): long-lived process that runs the engine CLIs (claude, codex, opencode, gemini) and owns
// the chat run registry and the chat_runs* tables. The web server only relays to it, so saving a file under
// ui/server (which restarts the --watch web server) no longer cuts an answer in progress.
// Never run this under --watch: it restarts only by explicit command (npm run host:stop, then npm run host).
//   node ui/engine-host.js          start (loopback only, port HARNESS_ENGINE_HOST_PORT, default 4322)
//   node ui/engine-host.js --stop   ask the running host to exit (cuts active runs)
//   node ui/engine-host.js --restart [--force|--cancel]   safe restart: waits for active runs (EP-23.05)
const http = require("http");
const { createHostHandler } = require("./server/services/engine-host/host-routes");
const { hostPort, hostUrl, loadOrCreateToken, readToken, TOKEN_HEADER } = require("./server/services/engine-host/protocol");
const { version } = require("../package.json");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createDrain } = require("./server/services/engine-host/drain");
const { foreignHostMessage } = require("./server/services/engine-host-client");
const { restartRunningHost } = require("./server/services/engine-host/restart-cli");
const { ROOT } = require("../tools/lib/root");

const BIND = "127.0.0.1";

/** Starts a fresh detached host once this one has released the port (EP-23.05 restart). */
function respawnDetached() {
  fs.mkdirSync(path.join(ROOT, "logs"), { recursive: true });
  const log = fs.openSync(path.join(ROOT, "logs", "engine-host.log"), "a");
  const child = spawn(process.execPath, [__filename], { detached: true, stdio: ["ignore", log, log], env: process.env, windowsHide: true });
  child.unref();
}

/**
 * @param {{ port?: number, onRestart?: () => void, drainLimitMs?: number }} [options] onRestart replaces the real
 *   restart (tests): it is called once the drain ends.
 * @returns {Promise<http.Server>}
 */
function startEngineHost(options = {}) {
  const token = loadOrCreateToken();
  /** @type {http.Server} */
  let server;
  const drain = createDrain({
    limitMs: options.drainLimitMs,
    onIdle: () => {
      if (options.onRestart) return options.onRestart();
      console.log(`[engine-host] drained, restarting (pid ${process.pid})`);
      server.close(() => {
        respawnDetached();
        process.exit(0);
      });
      server.closeAllConnections?.();
    },
  });
  const handler = createHostHandler({
    token,
    version,
    drain,
    startedAt: new Date().toISOString(),
    onShutdown: () => {
      console.log(`[engine-host] shutdown requested (pid ${process.pid})`);
      server.close();
      setTimeout(() => process.exit(0), 100).unref();
    },
  });
  server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      console.error("[engine-host]", (error && error.stack) || error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      if (!res.writableEnded) res.end(JSON.stringify({ error: "erro interno do host de motores" }));
    });
  });
  // SSE streams stay open for minutes; never time them out at the socket level.
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? hostPort(), BIND, () => resolve(server));
  });
}

async function stopRunningHost() {
  const token = readToken();
  if (!token) return console.log("[engine-host] no token file: the host never started here");
  try {
    const res = await fetch(`${hostUrl()}/shutdown`, { method: "POST", headers: { [TOKEN_HEADER]: token } });
    // EP-23.07: a host of another checkout refuses our token. Say so and fail; never claim a stop that did not happen.
    if (res.status === 401) {
      console.error(`[engine-host] ${await foreignHostMessage()}`);
      process.exitCode = 1;
      return;
    }
    if (!res.ok) {
      console.error(`[engine-host] the host answered ${res.status}; it was not stopped`);
      process.exitCode = 1;
      return;
    }
    const data = await res.json();
    console.log(`[engine-host] stop requested; runs cut: ${data.active ?? "?"}`);
  } catch {
    console.log("[engine-host] not running");
  }
}

module.exports = { startEngineHost };

if (require.main === module) {
  if (process.argv.includes("--stop")) {
    stopRunningHost();
  } else if (process.argv.includes("--restart")) {
    restartRunningHost(process.argv.slice(2)).then((result) => { if (result && result.foreign) process.exitCode = 1; });
  } else {
    // A rejection inside one engine must not take down every run of the host.
    process.on("unhandledRejection", (err) => console.error("[engine-host unhandledRejection]", (err && /** @type {any} */ (err).stack) || err));
    process.on("uncaughtException", (err) => console.error("[engine-host uncaughtException]", (err && err.stack) || err));
    startEngineHost()
      .then((server) => {
        const { port } = /** @type {import("net").AddressInfo} */ (server.address());
        console.log(`[engine-host] listening on http://${BIND}:${port} (pid ${process.pid})`);
      })
      .catch((error) => {
        console.error(`[engine-host] could not start: ${error.code === "EADDRINUSE" ? "port already in use (another host running?)" : error.message}`);
        process.exit(1);
      });
  }
}

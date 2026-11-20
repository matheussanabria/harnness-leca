// @ts-check
// Engine host (EP-23.03): long-lived process that runs the engine CLIs (claude, codex, opencode, gemini) and owns
// the chat run registry and the chat_runs* tables. The web server only relays to it, so saving a file under
// ui/server (which restarts the --watch web server) no longer cuts an answer in progress.
// Never run this under --watch: it restarts only by explicit command (npm run host:stop, then npm run host).
//   node ui/engine-host.js          start (loopback only, port HARNESS_ENGINE_HOST_PORT, default 4322)
//   node ui/engine-host.js --stop   ask the running host to exit
const http = require("http");
const { createHostHandler } = require("./server/services/engine-host/host-routes");
const { hostPort, hostUrl, loadOrCreateToken, readToken, TOKEN_HEADER } = require("./server/services/engine-host/protocol");
const { version } = require("../package.json");

const BIND = "127.0.0.1";

/**
 * @param {{ port?: number }} [options]
 * @returns {Promise<http.Server>}
 */
function startEngineHost(options = {}) {
  const token = loadOrCreateToken();
  /** @type {http.Server} */
  let server;
  const handler = createHostHandler({
    token,
    version,
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

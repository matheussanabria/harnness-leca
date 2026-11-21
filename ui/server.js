// @ts-check
// Servidor local sem dependências: lê as pastas do harness e serve a interface.
const http = require("http");
const { PORT, HOST, IS_REMOTE, PIN, send, hostOk, postOk, getActiveAppUrl, MAX_CHATS } = require("./server/config");
const { handle } = require("./server/router");
const netLib = require("../tools/lib/network");

/** Motion writes allowed past the method gate (EP-24): PUT of a screen timeline, DELETE of an export job. */
function isMotionWrite(/** @type {string} */ method, /** @type {string} */ url) {
  const p = url.split("?")[0];
  if (method === "PUT") return /^\/api\/project\/[\w-]+\/design\/prototypes\/[\w-]+\/motion\/[\w-]+$/.test(p);
  if (method === "DELETE") return /^\/api\/project\/[\w-]+\/design\/motion\/export\/[0-9a-f]{12}$/.test(p);
  return false;
}

function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      // PUT e DELETE existem só para a API do Canvas (/api/canvas/*, EP-16) e para a de motion (EP-24): a timeline de
      // uma tela (PUT, com rev) e o cancelamento de uma exportação (DELETE). Todo o resto continua 405.
      const canvasWrite = ((req.method === "PUT" || req.method === "DELETE") && /^\/api\/canvas\//.test(req.url || ""))
        || isMotionWrite(req.method || "", req.url || "");
      if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST" && req.method !== "PATCH" && !canvasWrite) {
        return send(res, 405, { error: "método não permitido" });
      }
      if (!hostOk(req)) {
        return send(res, 403, { error: "host não permitido" });
      }
      if ((req.method === "POST" || req.method === "PATCH" || canvasWrite) && !postOk(req)) {
        return send(res, 403, { error: "origem não permitida" });
      }
      await handle(req, res);
    } catch (err) {
      if (!res.headersSent && !res.writableEnded) {
        send(res, 400, { error: "requisição inválida" });
      }
    }
  });
  netLib.setupWebSocketHmrProxy(server, getActiveAppUrl, (req) => {
    try {
      // Upgrade não passa pela regra de Origin dos POSTs: sem esta checagem uma página qualquer aberta no navegador
      // do dono abriria um WebSocket para localhost. Origin ausente (cliente que não é navegador) ou igual ao Host.
      const origin = String(req.headers.origin || "").replace(/\/+$/, "").toLowerCase();
      const host = String(req.headers.host || "").toLowerCase();
      if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return false;
      return hostOk(req) && netLib.authorizeRemote(req, PIN, new URL(req.url || "/", "http://x")).ok;
    } catch {
      return false;
    }
  });
  return server;
}

module.exports = { createServer, MAX_CHATS };

if (require.main === module) {
  // Uma rejeição solta num motor não pode derrubar o processo e cortar todos os streams SSE abertos ("network error").
  process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", (err && err.stack) || err));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", (err && err.stack) || err));
  require("../tools/lib/ui-dev-guard").warnIfWatchOnMain();
  const srv = createServer();
  // Quem encerra o processo (reinício do --watch, Ctrl+C, queda) e quantas conexões abertas ele corta: sem isso, um
  // "network error" no navegador não diz se o servidor reiniciou. O --watch encerra o filho com SIGTERM.
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(sig, () => {
      srv.getConnections((_err, open) => {
        console.log(`[shutdown] ${new Date().toLocaleTimeString("pt-BR")} ${sig} (pid ${process.pid}); conexões abertas cortadas: ${open ?? "?"}`);
        process.exit(0);
      });
    });
  }
  srv.listen(PORT, HOST, () => {
    console.log(`[boot] ${new Date().toLocaleTimeString("pt-BR")} pid ${process.pid}`);
    if (IS_REMOTE) {
      const summary = netLib.getRemoteSummary(PORT, PIN);
      netLib.printRemoteBanner(summary);
    } else {
      console.log(`Harness UI: http://localhost:${PORT}`);
      console.log(`(Para habilitar acesso pelo celular no Wi-Fi/4G, inicie com: npm run remote)`);
    }
    // EP-23.03: the engine host runs the engine CLIs outside this (restartable) process; start it if it is down.
    try {
      if (require("./server/services/engine-host/protocol").isHostMode()) {
        require("./server/services/engine-host-client").ensureHost().catch((err) => console.log("[engine-host]", err.message));
      }
    } catch {
      /* the first chat request retries */
    }
    // 9router e opencode: sobe em segundo plano os que estiverem desligados (HARNESS_AUTOSTART=0 desliga).
    try {
      require("../tools/lib/engine-autostart").ensureEngineServices().catch((err) => console.log("[autostart]", err.message));
    } catch {
      /* o servidor segue sem o autostart */
    }
    // Presenca de sessoes externas (T2.4): HARNESS_PRESENCE=0 desliga; erros sao contados, nunca fatais.
    try {
      require("./server/services/external-presence/presence-runtime").startPresenceScanner();
    } catch {
      /* o servidor segue sem o scanner */
    }
    // Conversas sempre em dia: observa os motores e roda tools/sync.js em segundo plano (HARNESS_AUTOSYNC=0 desliga).
    try {
      require("./server/services/auto-sync.service").startAutoSync({ root: require("path").resolve(__dirname, "..") });
    } catch {
      /* o servidor segue sem o sync automatico */
    }
    // Uso por chamada do Claude Code a partir dos transcritos (T3.1): HARNESS_USAGE=0 desliga.
    try {
      require("./server/services/usage-ingest/usage-runtime").startUsageIngest();
    } catch {
      /* o servidor segue sem a ingestao de uso */
    }
  });
}

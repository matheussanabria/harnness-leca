// @ts-check
// Servidor local sem dependências: lê as pastas do harness e serve a interface.
const http = require("http");
const { PORT, HOST, IS_REMOTE, PIN, send, hostOk, postOk, getActiveAppUrl, MAX_CHATS } = require("./server/config");
const { handle } = require("./server/router");
const netLib = require("../tools/lib/network");

function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST" && req.method !== "PATCH") {
        return send(res, 405, { error: "método não permitido" });
      }
      if (!hostOk(req)) {
        return send(res, 403, { error: "host não permitido" });
      }
      if ((req.method === "POST" || req.method === "PATCH") && !postOk(req)) {
        return send(res, 403, { error: "origem não permitida" });
      }
      await handle(req, res);
    } catch (err) {
      if (!res.headersSent && !res.writableEnded) {
        send(res, 400, { error: "requisição inválida" });
      }
    }
  });
  netLib.setupWebSocketHmrProxy(server, getActiveAppUrl);
  return server;
}

module.exports = { createServer, MAX_CHATS };

if (require.main === module) {
  // Uma rejeição solta num motor não pode derrubar o processo e cortar todos os streams SSE abertos ("network error").
  process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", (err && err.stack) || err));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", (err && err.stack) || err));
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
    // Uso por chamada do Claude Code a partir dos transcritos (T3.1): HARNESS_USAGE=0 desliga.
    try {
      require("./server/services/usage-ingest/usage-runtime").startUsageIngest();
    } catch {
      /* o servidor segue sem a ingestao de uso */
    }
  });
}

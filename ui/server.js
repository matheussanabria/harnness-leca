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
  const srv = createServer();
  srv.listen(PORT, HOST, () => {
    if (IS_REMOTE) {
      const summary = netLib.getRemoteSummary(PORT, PIN);
      netLib.printRemoteBanner(summary);
    } else {
      console.log(`Harness UI: http://localhost:${PORT}`);
      console.log(`(Para habilitar acesso pelo celular no Wi-Fi/4G, inicie com: npm run remote)`);
    }
    // Presenca de sessoes externas (T2.4): HARNESS_PRESENCE=0 desliga; erros sao contados, nunca fatais.
    try {
      require("./server/services/external-presence/presence-runtime").startPresenceScanner();
    } catch {
      /* o servidor segue sem o scanner */
    }
  });
}

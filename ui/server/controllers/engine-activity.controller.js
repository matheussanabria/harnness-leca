// @ts-check
// Controller para leitura de presença e atividade de motores (EP-09.06).
const { getEngineMonitor } = require("../../../tools/lib/engine-monitor/monitor.service");

/**
 * GET /api/engines/activity
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
async function getEngineActivity(req, res) {
  // Restrição de loopback
  const remoteIp = req.socket.remoteAddress || "";
  const isLoopback = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
  if (!isLoopback) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Acesso restrito ao loopback" }));
    return;
  }

  try {
    const monitor = getEngineMonitor();
    const status = await monitor.getStatus();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(status));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: `Falha ao obter status dos motores: ${err.message}` }));
  }
}

module.exports = {
  getEngineActivity,
};

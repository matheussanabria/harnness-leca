// @ts-check
// Controller para leitura de presença e atividade de motores (EP-09.06).
const { getEngineMonitor } = require("../../../tools/lib/engine-monitor/monitor.service");
const netLib = require("../../../tools/lib/network");

/**
 * GET /api/engines/activity
 * @param {any} arg objeto do roteador { req, res } ou a própria requisição
 * @param {import("http").ServerResponse} [maybeRes] resposta, quando chamado como (req, res)
 */
async function getEngineActivity(arg, maybeRes) {
  // O roteador chama o handler com { req, res, url, params }; os testes antigos chamam (req, res).
  const req = maybeRes ? arg : arg.req;
  const res = maybeRes || arg.res;
  // Restrição ao host local direto: o túnel também conecta do loopback, então o socket sozinho não basta.
  if (!netLib.isLocalhostRequest(req)) {
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

// @ts-check
// Controller dos indicadores de saude dos ambientes (EP-10.02).
const { send, readJsonBody } = require("../config");
const netLib = require("../../../tools/lib/network");
const { readHealthChecks, writeHealthChecks } = require("../services/deploy/health-store");
const { normalizeCheck, fail } = require("../services/deploy/health-definitions");
const { listHealth, runHealthCheck, requireEnvironment } = require("../services/deploy/health-runner.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operacao." });
}

/** GET /api/deploy/health */
function apiDeployHealth({ res }) {
  try {
    return send(res, 200, listHealth());
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/health/checks */
async function apiDeployHealthChecksSave({ req, res }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Gravacao de verificacoes restrita ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON invalido" });
  try {
    const incoming = Array.isArray(body.checks) ? body.checks : [body.check];
    const checks = incoming.filter(Boolean).map(normalizeCheck);
    if (!checks.length) throw fail(400, "Nenhuma verificacao informada.");
    for (const check of checks) requireEnvironment(check.projectId, check.envId);
    const manifest = readHealthChecks();
    const merged = new Map(manifest.checks.map((item) => [item.id, item]));
    for (const check of checks) merged.set(check.id, check);
    const list = [...merged.values()];
    if (!writeHealthChecks(list)) throw fail(500, "Nao foi possivel gravar o manifesto de saude.");
    return send(res, 200, { ok: true, checks: list, totals: { checks: list.length } });
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/health/checks/:id/run */
async function apiDeployHealthCheckRun({ req, res, params: [checkId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Execucao de verificacao restrita ao host local." });
  }
  try {
    await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  try {
    const measurement = await runHealthCheck(checkId);
    return send(res, 200, { ok: measurement.ok, measurement });
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiDeployHealth,
  apiDeployHealthChecksSave,
  apiDeployHealthCheckRun,
};

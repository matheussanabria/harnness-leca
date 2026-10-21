// @ts-check
// Controller da linha do tempo e dos logs de deploy (EP-10.03).
const { send } = require("../config");
const { buildTimeline, KINDS } = require("../services/deploy/deploy-timeline.service");
const { buildDeployLogs } = require("../services/deploy/deploy-logs.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operacao." });
}

/**
 * Valida os filtros comuns da linha do tempo.
 * @param {URLSearchParams} params
 */
function readFilters(params) {
  const limit = Number(params.get("limit") || 0);
  if (params.get("limit") && (!Number.isFinite(limit) || limit < 1)) {
    const error = new Error("Limite invalido.");
    // @ts-ignore
    error.status = 400;
    throw error;
  }
  const kind = params.get("kind") || "";
  if (kind && !KINDS.includes(kind)) {
    const error = new Error("Tipo de entrada desconhecido.");
    // @ts-ignore
    error.status = 400;
    throw error;
  }
  return {
    projectId: params.get("projectId") || "",
    envId: params.get("envId") || "",
    kind,
    status: params.get("status") || "",
    limit: limit || undefined,
  };
}

/** GET /api/deploy/timeline */
function apiDeployTimeline({ res, url }) {
  try {
    const filters = readFilters(url.searchParams);
    return send(res, 200, buildTimeline(filters));
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/deploy/logs */
function apiDeployLogs({ res, url }) {
  try {
    const filters = readFilters(url.searchParams);
    return send(res, 200, buildDeployLogs(filters));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = { apiDeployTimeline, apiDeployLogs };

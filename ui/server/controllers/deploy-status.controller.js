// @ts-check
// Controller do resumo operacional de deploy (EP-10.05).
const { send } = require("../config");
const { buildDeployStatus } = require("../services/deploy/deploy-status.service");

/** GET /api/deploy/status */
function apiDeployStatus({ res }) {
  try {
    return send(res, 200, buildDeployStatus());
  } catch (err) {
    return send(res, 500, { error: err.message || "Falha ao montar o resumo operacional." });
  }
}

module.exports = { apiDeployStatus };

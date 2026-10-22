// @ts-check
// Controller das acoes de deploy autorizadas (EP-10.04).
const { send, readJsonBody } = require("../config");
const netLib = require("../../../tools/lib/network");
const { listActions } = require("../services/deploy/action-policy.service");
const { issueAuthorization } = require("../services/deploy/authorization.service");
const { describeAction, executeAction } = require("../services/deploy/deploy-actions.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operacao." });
}

/** GET /api/deploy/actions */
function apiDeployActions({ res }) {
  try {
    const actions = listActions().map((action) => ({
      ...action,
      plan: describeAction(action.id).plan,
    }));
    return send(res, 200, { ok: true, actions, totals: { actions: actions.length } });
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/actions/:id/authorize */
async function apiDeployActionAuthorize({ req, res, params: [actionId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Emissao de autorizacao restrita ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON invalido" });
  try {
    const authorization = issueAuthorization({
      actionId,
      actor: body.actor,
      note: body.note,
    });
    return send(res, 200, { ok: true, authorization });
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/deploy/actions/:id/execute */
async function apiDeployActionExecute({ req, res, params: [actionId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Execucao de acao restrita ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON invalido" });
  try {
    const result = await executeAction({
      actionId,
      authorizationId: body.authorizationId,
      confirm: body.confirm === true,
      dryRun: body.dryRun === true,
      actor: body.actor,
    });
    return send(res, 200, result);
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiDeployActions,
  apiDeployActionAuthorize,
  apiDeployActionExecute,
};

// @ts-check
// Controller da fila de aprovações e da decisão de aprovação (EP-08.05).
const { send, readJsonBody } = require("../config");
const netLib = require("../../../tools/lib/network");
const { approveWorkflowRun, listPendingApprovals } = require("../services/orchestration/workflow-approval.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operação." });
}

/** GET /api/orchestration/approvals */
function apiOrchestrationApprovals({ res, url }) {
  const slug = url.searchParams.get("slug") || "";
  return send(res, 200, { approvals: listPendingApprovals(slug) });
}

/** POST /api/orchestration/workflow-runs/:executionId/approve */
async function apiOrchestrationWorkflowRunApprove({ req, res, params: [executionId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Decisão de aprovação restrita ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON inválido" });
  try {
    return send(res, 200, approveWorkflowRun(executionId, {
      stageId: body.stageId,
      decision: body.decision,
      actor: body.actor,
      note: body.note,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiOrchestrationApprovals,
  apiOrchestrationWorkflowRunApprove,
};

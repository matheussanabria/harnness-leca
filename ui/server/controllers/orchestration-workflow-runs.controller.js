// @ts-check
// Controller do ciclo de vida das execuções de workflow (EP-08.04).
const { send, readJsonBody } = require("../config");
const netLib = require("../../../tools/lib/network");
const {
  listWorkflowRuns,
  getWorkflowRun,
  advanceWorkflowRun,
  cancelWorkflowRun,
} = require("../services/orchestration/workflow-runner.service");

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operação." });
}

function requireLoopback(req, res) {
  if (netLib.isLocalhostRequest(req)) return false;
  send(res, 403, { error: "Operação restrita ao host local." });
  return true;
}

async function readBody(res, req) {
  try {
    return await readJsonBody(req);
  } catch {
    send(res, 400, { error: "JSON inválido" });
    return null;
  }
}

/** GET /api/orchestration/workflow-runs */
function apiOrchestrationWorkflowRuns({ res, url }) {
  const slug = url.searchParams.get("slug") || "";
  return send(res, 200, { runs: listWorkflowRuns(slug) });
}

/** GET /api/orchestration/workflow-runs/:executionId */
function apiOrchestrationWorkflowRunDetail({ res, params: [executionId] }) {
  const run = getWorkflowRun(executionId);
  if (!run) return send(res, 404, { error: "Execução não encontrada." });
  return send(res, 200, run);
}

/** POST /api/orchestration/workflow-runs/:executionId/advance */
async function apiOrchestrationWorkflowRunAdvance({ req, res, params: [executionId] }) {
  if (requireLoopback(req, res)) return;
  const body = await readBody(res, req);
  if (!body) return;
  try {
    return send(res, 200, advanceWorkflowRun(executionId, {
      stageId: body.stageId,
      status: body.status,
      note: body.note,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/orchestration/workflow-runs/:executionId/cancel */
async function apiOrchestrationWorkflowRunCancel({ req, res, params: [executionId] }) {
  if (requireLoopback(req, res)) return;
  const body = await readBody(res, req);
  if (!body) return;
  try {
    return send(res, 200, cancelWorkflowRun(executionId, { reason: body.reason }));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiOrchestrationWorkflowRuns,
  apiOrchestrationWorkflowRunDetail,
  apiOrchestrationWorkflowRunAdvance,
  apiOrchestrationWorkflowRunCancel,
};

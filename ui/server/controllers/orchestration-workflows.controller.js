// @ts-check
// Controller do catálogo de workflows e do início de execução por projeto (EP-08.04).
const fs = require("fs");
const path = require("path");
const { send, readJsonBody, getProjects } = require("../config");
const netLib = require("../../../tools/lib/network");
const { listWorkflows, getWorkflow } = require("../services/orchestration/workflow-definitions");
const { buildWorkflowPlan } = require("../services/orchestration/workflow-plan.service");
const { startWorkflowRun } = require("../services/orchestration/workflow-runner.service");

function projectDir(slug) {
  const dir = path.join(getProjects(), String(slug || "").trim());
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : "";
}

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operação." });
}

/** GET /api/orchestration/workflows */
function apiOrchestrationWorkflows({ res }) {
  return send(res, 200, { workflows: listWorkflows() });
}

/** GET /api/orchestration/workflows/:id */
function apiOrchestrationWorkflow({ res, params: [id] }) {
  const workflow = getWorkflow(id);
  if (!workflow) return send(res, 404, { error: "Workflow desconhecido." });
  return send(res, 200, workflow);
}

/** GET /api/project/:slug/workflow-plan/:workflowId */
function apiProjectWorkflowPlan({ res, params: [slug, workflowId], url }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto não encontrado." });
  const laneId = url.searchParams.get("laneId") || "";
  try {
    return send(res, 200, buildWorkflowPlan({ slug, projectDir: dir, workflowId, laneId }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/project/:slug/workflows/:workflowId/runs */
async function apiProjectWorkflowRun({ req, res, params: [slug, workflowId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Início de execução restrito ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto não encontrado." });
  try {
    return send(res, 200, startWorkflowRun({
      slug,
      projectDir: dir,
      workflowId,
      laneId: body?.laneId,
      actor: body?.actor,
      dryRun: body?.dryRun === true,
      idempotencyKey: body?.idempotencyKey,
      // Optional T4.1c opt-in: only a real boolean true enables it; anything else
      // is safely ignored (default remains "a failed stage ends the run").
      allowRetryAfterFailure: body?.allowRetryAfterFailure === true,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiOrchestrationWorkflows,
  apiOrchestrationWorkflow,
  apiProjectWorkflowPlan,
  apiProjectWorkflowRun,
};

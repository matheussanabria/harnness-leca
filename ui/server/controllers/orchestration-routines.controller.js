// @ts-check
// Controller das rotinas de workflow e do histórico persistido (EP-08.05).
const fs = require("fs");
const path = require("path");
const { send, readJsonBody, getProjects } = require("../config");
const netLib = require("../../../tools/lib/network");
const { listRoutines } = require("../services/orchestration/routine-definitions");
const { listProjectRoutines, runRoutine } = require("../services/orchestration/routine-runner.service");
const { readWorkflowHistory } = require("../services/orchestration/workflow-history.service");

function projectDir(slug) {
  const dir = path.join(getProjects(), String(slug || "").trim());
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : "";
  } catch {
    return "";
  }
}

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operação." });
}

/** GET /api/orchestration/routines */
function apiOrchestrationRoutines({ res }) {
  return send(res, 200, { routines: listRoutines() });
}

/** GET /api/project/:slug/routines */
function apiProjectRoutines({ res, params: [slug], url }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto não encontrado." });
  const laneId = url.searchParams.get("laneId") || "";
  try {
    return send(res, 200, listProjectRoutines({ slug, projectDir: dir, laneId }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/project/:slug/routines/:routineId/run */
async function apiProjectRoutineRun({ req, res, params: [slug, routineId] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Execução de rotina restrita ao host local." });
  }
  let body = {};
  try {
    body = (await readJsonBody(req)) || {};
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto não encontrado." });
  try {
    return send(res, 200, runRoutine({
      slug,
      projectDir: dir,
      routineId,
      laneId: body.laneId,
      actor: body.actor,
      idempotencyKey: body.idempotencyKey,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/project/:slug/workflow-history */
function apiProjectWorkflowHistory({ res, params: [slug], url }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto não encontrado." });
  const limit = Number(url.searchParams.get("limit") || 50) || 50;
  try {
    return send(res, 200, readWorkflowHistory(dir, { limit }));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiOrchestrationRoutines,
  apiProjectRoutines,
  apiProjectRoutineRun,
  apiProjectWorkflowHistory,
};

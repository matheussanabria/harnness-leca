// @ts-check
// Execução de rotinas: catálogo resolvido no projeto, gatilho e idempotência (EP-08.05).
const {
  listRoutines,
  getRoutine,
  isValidRoutine,
  isDue,
  isScheduled,
  routineIdempotencyKey,
} = require("./routine-definitions");
const { buildWorkflowPlan } = require("./workflow-plan.service");
const { startWorkflowRun } = require("./workflow-runner.service");
const { listRuns } = require("./workflow-run-store");

const MAX_ROUTINE_ACTOR = 80;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

/**
 * Detecta se a janela corrente da rotina já foi executada.
 * @param {string} routineId
 * @param {string} slug
 * @param {Date} now
 * @returns {boolean}
 */
function executedInWindow(routineId, slug, now) {
  const key = routineIdempotencyKey(routineId, slug, now);
  if (!key) return false;
  return listRuns(slug, routineId).some((run) => run.idempotencyKey === key);
}

/**
 * Lista as rotinas resolvidas no projeto, com plano, próxima execução e avisos.
 * @param {{ slug: string, projectDir: string, laneId?: string, now?: Date }} params
 * @returns {{ routines: Object[], totals: Object }}
 */
function listProjectRoutines({ slug, projectDir, laneId = "", now = new Date() }) {
  const routines = listRoutines().map((routine) => {
    const detail = { ...routine, laneId: laneId || routine.laneId };
    let plan = null;
    try {
      plan = buildWorkflowPlan({ slug, projectDir, workflowId: routine.workflowId, laneId: detail.laneId });
    } catch {
      plan = null;
    }
    const runs = listRuns(slug, routine.id);
    const last = runs[0] || null;
    const due = isDue(routine, now) && !executedInWindow(routine.id, slug, now);
    return {
      ...detail,
      due,
      plan: plan
        ? {
            workflowId: plan.workflow.id,
            stageCount: plan.stages.length,
            approvalsRequired: plan.totals.approvalsRequired,
            missing: plan.missing,
            warnings: plan.warnings,
          }
        : null,
      lastRun: last
        ? {
            executionId: last.executionId,
            status: last.status,
            startedAt: last.startedAt,
            currentStage: last.currentStage,
          }
        : null,
      executions: runs.length,
    };
  });
  return {
    routines,
    totals: {
      total: routines.length,
      due: routines.filter((item) => item.due).length,
      scheduled: routines.filter((item) => item.scheduled).length,
    },
  };
}

/**
 * Executa uma rotina de forma idempotente na janela corrente.
 * @param {{ slug: string, projectDir: string, routineId: string, laneId?: string, actor?: string, idempotencyKey?: string, now?: Date }} params
 * @returns {Object}
 */
function runRoutine({ slug, projectDir, routineId, laneId = "", actor = "", idempotencyKey = "", now = new Date() }) {
  const id = String(routineId || "").trim();
  if (!isValidRoutine(id)) throw fail(404, "Rotina desconhecida.");
  const routine = getRoutine(id);
  if (!routine) throw fail(404, "Rotina desconhecida.");

  const explicitKey = String(idempotencyKey || "").trim();
  const key = explicitKey || routineIdempotencyKey(id, slug, now);
  const result = startWorkflowRun({
    slug,
    projectDir,
    workflowId: routine.workflowId,
    laneId: laneId || routine.laneId,
    actor: String(actor || "").trim().slice(0, MAX_ROUTINE_ACTOR),
    idempotencyKey: key,
    routineId: id,
  });
  return {
    ok: true,
    routineId: id,
    idempotent: Boolean(result.idempotent),
    scheduled: isScheduled(routine),
    run: result.run,
  };
}

/**
 * Rotinas agendadas que já venceram e ainda não rodaram na janela corrente.
 * @param {{ slug: string, projectDir: string, laneId?: string, now?: Date }} params
 * @returns {Object[]}
 */
function listDueRoutines({ slug, projectDir, laneId = "", now = new Date() }) {
  return listProjectRoutines({ slug, projectDir, laneId, now }).routines.filter((item) => item.due);
}

module.exports = { listProjectRoutines, listDueRoutines, runRoutine, executedInWindow };

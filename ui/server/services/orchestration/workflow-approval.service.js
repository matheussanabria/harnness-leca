// @ts-check
// Aprovações das etapas sensíveis de uma execução de workflow (EP-08.05).
const { getRun, listRuns, snapshot, track, MAX_APPROVALS } = require("./workflow-run-store");
const { emitWorkflowEvent } = require("./workflow-events");
const { recordWorkflowEvent } = require("./workflow-history.service");

const DECISIONS = new Set(["approved", "rejected"]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function findApproval(run, stageId) {
  return run.approvals.find((item) => item.stageId === stageId) || null;
}

function hasDecision(run, stageId) {
  return Boolean(findApproval(run, stageId));
}

function isStageApproved(run, stageId) {
  const approval = findApproval(run, stageId);
  return Boolean(approval && approval.decision === "approved");
}

function approveWorkflowRun(executionId, { stageId, decision, actor, note } = {}) {
  const run = getRun(executionId);
  if (!run) throw fail(404, "Execução não encontrada.");
  if (run.status !== "running" && run.status !== "blocked") throw fail(409, "Execução já encerrada.");

  const current = run.stageState[run.currentIndex];
  if (!current) throw fail(409, "Execução sem etapa corrente.");
  const target = String(stageId || current.id).trim();
  if (target !== current.id) throw fail(409, `Aprovação fora de ordem: aguardando '${current.id}'.`);
  if (!current.requiresApproval) throw fail(409, `A etapa '${current.id}' não exige aprovação.`);

  const value = String(decision || "").trim();
  if (!DECISIONS.has(value)) throw fail(400, "Decisão de aprovação inválida.");
  if (hasDecision(run, target)) throw fail(409, "Etapa já decidida.");
  if (run.approvals.length >= MAX_APPROVALS) throw fail(409, "Limite de decisões atingido.");

  const entry = {
    stageId: target,
    decision: value,
    actor: String(actor || "").trim().slice(0, 80),
    note: String(note || "").slice(0, 500),
    at: new Date().toISOString(),
  };
  run.approvals.push(entry);
  run.approvalRequested = "";
  track(run, "");

  const payload = {
    title: current.label,
    stageId: target,
    decision: value,
    actor: entry.actor,
    note: entry.note,
  };

  if (value === "rejected") {
    track(run, emitWorkflowEvent({
      type: "execution.rejected",
      projectId: run.slug,
      executionId: run.executionId,
      taskId: `stage:${target}`,
      payload,
    }));
    recordWorkflowEvent(run.projectDir, {
      slug: run.slug,
      executionId: run.executionId,
      workflowId: run.workflowId,
      stageId: target,
      decision: value,
      actor: entry.actor,
      note: entry.note,
      type: "execution.rejected",
      status: "cancelled",
    });
    track(run, emitWorkflowEvent({
      type: "execution.cancelled",
      projectId: run.slug,
      executionId: run.executionId,
      payload: { reason: `Aprovação negada em '${target}'.`, note: entry.note, actor: entry.actor },
    }));
    recordWorkflowEvent(run.projectDir, {
      slug: run.slug,
      executionId: run.executionId,
      workflowId: run.workflowId,
      type: "execution.cancelled",
      status: "cancelled",
      note: `Aprovação negada em '${target}'.`,
    });
    run.status = "cancelled";
    run.finishedAt = new Date().toISOString();
  } else {
    track(run, emitWorkflowEvent({
      type: "execution.approved",
      projectId: run.slug,
      executionId: run.executionId,
      taskId: `stage:${target}`,
      payload,
    }));
    recordWorkflowEvent(run.projectDir, {
      slug: run.slug,
      executionId: run.executionId,
      workflowId: run.workflowId,
      stageId: target,
      decision: value,
      actor: entry.actor,
      note: entry.note,
      type: "execution.approved",
      status: "approved",
    });
  }

  return { ok: true, decision: { ...entry }, run: snapshot(run) };
}

/**
 * Fila de aprovações pendentes: etapa corrente que exige decisão e ainda não foi decidida.
 * @param {string} [slug]
 * @returns {Object[]}
 */
function listPendingApprovals(slug) {
  const wanted = String(slug || "").trim();
  const pending = [];
  for (const run of listRuns(wanted)) {
    if (run.status !== "running" && run.status !== "blocked") continue;
    const current = run.currentStage;
    if (!current || !current.requiresApproval) continue;
    if (run.approvals.some((item) => item.stageId === current.id)) continue;
    pending.push({
      executionId: run.executionId,
      slug: run.slug,
      workflowId: run.workflowId,
      routineId: run.routineId,
      stageId: current.id,
      stageLabel: current.label,
      actor: run.actor,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      status: run.status,
    });
  }
  return pending;
}

module.exports = {
  DECISIONS,
  findApproval,
  hasDecision,
  isStageApproved,
  approveWorkflowRun,
  listPendingApprovals,
};

// @ts-check
// Execução de workflows: ciclo de vida, idempotência e rastreabilidade (EP-08.04, EP-08.05).
const crypto = require("node:crypto");
const { getStage } = require("./agent-stage-catalog");
const { buildWorkflowPlan } = require("./workflow-plan.service");
const { emitWorkflowEvent } = require("./workflow-events");
const {
  putRun,
  getRun,
  listRuns,
  snapshot,
  track,
  findIdempotency,
  claimIdempotency,
} = require("./workflow-run-store");
const { isStageApproved } = require("./workflow-approval.service");
const { recordWorkflowEvent } = require("./workflow-history.service");

const STAGE_STATUSES = new Set(["started", "progressed", "completed", "blocked", "failed"]);
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,120}$/;

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function record(run, entry) {
  return recordWorkflowEvent(run.projectDir, {
    slug: run.slug,
    executionId: run.executionId,
    workflowId: run.workflowId,
    actor: run.actor,
    ...entry,
  });
}

function startWorkflowRun({ slug, projectDir, workflowId, laneId, actor, dryRun, idempotencyKey, routineId }) {
  const plan = buildWorkflowPlan({ slug, projectDir, workflowId, laneId });
  if (dryRun) return { ok: true, dryRun: true, plan };

  const key = String(idempotencyKey || "").trim();
  if (key && !IDEMPOTENCY_KEY.test(key)) throw fail(400, "Chave de idempotência inválida.");
  const scope = key ? `${slug}:${plan.workflow.id}:${key}` : "";
  if (scope) {
    const previous = getRun(findIdempotency(scope));
    if (previous) return { ok: true, dryRun: false, idempotent: true, run: snapshot(previous) };
  }

  const now = new Date().toISOString();
  const run = {
    executionId: `wf-${crypto.randomUUID()}`,
    slug,
    projectDir,
    workflowId: plan.workflow.id,
    routineId: String(routineId || "").trim().slice(0, 80),
    laneId: plan.laneId,
    actor: String(actor || "").trim().slice(0, 80),
    idempotencyKey: key,
    status: "running",
    startedAt: now,
    updatedAt: now,
    finishedAt: "",
    currentIndex: 0,
    error: "",
    warnings: [...plan.warnings],
    stageState: plan.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      requiresApproval: stage.requiresApproval,
      status: "pending",
    })),
    approvals: [],
    approvalRequested: "",
    eventIds: [],
  };
  putRun(run);
  if (scope) claimIdempotency(scope, run.executionId);

  track(run, emitWorkflowEvent({
    type: "execution.started",
    projectId: slug,
    executionId: run.executionId,
    payload: {
      title: `${plan.workflow.label} (${slug})`,
      workflowId: run.workflowId,
      routineId: run.routineId,
      laneId: run.laneId,
      actor: run.actor,
      stages: run.stageState.length,
      approvalsRequired: plan.totals.approvalsRequired,
      warnings: plan.warnings,
    },
  }));
  record(run, { type: "execution.started", status: "running", note: plan.workflow.label });

  for (const stage of plan.stages) {
    track(run, emitWorkflowEvent({
      type: "task.created",
      projectId: slug,
      executionId: run.executionId,
      taskId: `stage:${stage.id}`,
      payload: { title: stage.label, order: stage.order, requiresApproval: stage.requiresApproval },
    }));
  }

  requestApprovalIfNeeded(run);

  return { ok: true, dryRun: false, idempotent: false, run: snapshot(run) };
}

/**
 * Publica a solicitação de aprovação quando a etapa corrente exige decisão.
 * @param {any} run
 */
function requestApprovalIfNeeded(run) {
  const current = run.stageState[run.currentIndex];
  if (!current || !current.requiresApproval) return;
  if (isStageApproved(run, current.id)) return;
  if (run.approvalRequested === current.id) return;
  run.approvalRequested = current.id;
  track(run, emitWorkflowEvent({
    type: "execution.approval_requested",
    projectId: run.slug,
    executionId: run.executionId,
    taskId: `stage:${current.id}`,
    payload: { title: current.label, stageId: current.id },
  }));
  record(run, { type: "execution.approval_requested", status: "awaiting_approval", stageId: current.id, note: current.label });
}

function advanceWorkflowRun(executionId, { stageId, status, note } = {}) {
  const run = getRun(executionId);
  if (!run) throw fail(404, "Execução não encontrada.");
  if (run.status !== "running" && run.status !== "blocked") throw fail(409, "Execução já encerrada.");

  const current = run.stageState[run.currentIndex];
  if (!current) throw fail(409, "Execução sem etapa corrente.");
  const target = String(stageId || current.id).trim();
  if (target !== current.id) throw fail(409, `Etapa fora de ordem: aguardando '${current.id}'.`);

  const state = String(status || "started").trim();
  if (!STAGE_STATUSES.has(state)) throw fail(400, "Status de etapa inválido.");
  // Qualquer avanço após um bloqueio libera a execução para seguir.
  if (run.status === "blocked") run.status = "running";

  const taskId = `stage:${current.id}`;
  const payload = { title: current.label, order: run.currentIndex, note: String(note || "").slice(0, 500) };

  if (state === "completed") {
    if (current.requiresApproval && !isStageApproved(run, current.id)) {
      throw fail(409, `A etapa '${current.id}' exige aprovação registrada.`);
    }
    current.status = "completed";
    track(run, emitWorkflowEvent({ type: "task.completed", projectId: run.slug, executionId: run.executionId, taskId, payload }));
    record(run, { type: "task.completed", status: "completed", stageId: current.id, note: payload.note });
    if (run.currentIndex === run.stageState.length - 1) {
      track(run, emitWorkflowEvent({
        type: "execution.completed",
        projectId: run.slug,
        executionId: run.executionId,
        payload: { title: `${run.workflowId} (${run.slug})`, stages: run.stageState.length },
      }));
      record(run, { type: "execution.completed", status: "completed" });
      run.status = "completed";
      run.finishedAt = new Date().toISOString();
    } else {
      run.currentIndex += 1;
      requestApprovalIfNeeded(run);
    }
    return { ok: true, run: snapshot(run) };
  }

  if (state === "failed") {
    current.status = "failed";
    run.error = payload.note || "Etapa com falha";
    track(run, emitWorkflowEvent({ type: "task.failed", projectId: run.slug, executionId: run.executionId, taskId, payload: { ...payload, error: run.error } }));
    track(run, emitWorkflowEvent({ type: "execution.failed", projectId: run.slug, executionId: run.executionId, payload: { error: run.error } }));
    record(run, { type: "execution.failed", status: "failed", stageId: current.id, note: run.error });
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    return { ok: true, run: snapshot(run) };
  }

  if (state === "blocked") {
    current.status = "blocked";
    run.status = "blocked";
    track(run, emitWorkflowEvent({ type: "task.blocked", projectId: run.slug, executionId: run.executionId, taskId, payload }));
    record(run, { type: "task.blocked", status: "blocked", stageId: current.id, note: payload.note });
    return { ok: true, run: snapshot(run) };
  }

  if (current.status === "pending") current.status = state === "progressed" ? "progressed" : "running";
  else if (state === "progressed") current.status = "progressed";
  const type = state === "progressed" ? "task.progressed" : "task.started";
  track(run, emitWorkflowEvent({ type, projectId: run.slug, executionId: run.executionId, taskId, payload }));
  return { ok: true, run: snapshot(run) };
}

function cancelWorkflowRun(executionId, { reason } = {}) {
  const run = getRun(executionId);
  if (!run) throw fail(404, "Execução não encontrada.");
  if (run.status !== "running" && run.status !== "blocked") throw fail(409, "Execução já encerrada.");
  const text = String(reason || "").slice(0, 500);
  track(run, emitWorkflowEvent({
    type: "execution.cancelled",
    projectId: run.slug,
    executionId: run.executionId,
    payload: { reason: text },
  }));
  record(run, { type: "execution.cancelled", status: "cancelled", note: text });
  run.status = "cancelled";
  run.finishedAt = new Date().toISOString();
  return { ok: true, run: snapshot(run) };
}

function listWorkflowRuns(slug) {
  return listRuns(slug);
}

function getWorkflowRun(executionId) {
  const run = getRun(executionId);
  return run ? snapshot(run) : null;
}

module.exports = {
  STAGE_STATUSES,
  startWorkflowRun,
  advanceWorkflowRun,
  cancelWorkflowRun,
  listWorkflowRuns,
  getWorkflowRun,
};

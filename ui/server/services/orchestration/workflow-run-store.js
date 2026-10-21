// @ts-check
// Estado em memória das execuções de workflow e índice de idempotência (EP-08.04, EP-08.05).

const MAX_RUNS = 200;
const MAX_APPROVALS = 20;

/** @type {Map<string, any>} */
const runs = new Map();
/** @type {Map<string, string>} */
const idempotency = new Map();

function putRun(run) {
  runs.set(run.executionId, run);
  if (runs.size > MAX_RUNS) {
    const oldest = runs.keys().next().value;
    const dropped = runs.get(oldest);
    runs.delete(oldest);
    if (dropped?.idempotencyKey) idempotency.delete(dropped.idempotencyKey);
  }
  return run;
}

function getRun(executionId) {
  return runs.get(String(executionId || "").trim()) || null;
}

function listRuns(slug, routineId) {
  const wanted = String(slug || "").trim();
  const routine = String(routineId || "").trim();
  return [...runs.values()]
    .filter((run) => (!wanted || run.slug === wanted) && (!routine || run.routineId === routine))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map(snapshot);
}

function snapshot(run) {
  const active = run.status === "running" || run.status === "blocked";
  const current = active ? run.stageState[run.currentIndex] || null : null;
  const completed = run.stageState.filter((item) => item.status === "completed").length;
  return {
    executionId: run.executionId,
    slug: run.slug,
    workflowId: run.workflowId,
    routineId: run.routineId || "",
    laneId: run.laneId,
    actor: run.actor,
    idempotencyKey: run.idempotencyKey || "",
    status: run.status,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    currentStage: current ? { id: current.id, label: current.label, requiresApproval: current.requiresApproval } : null,
    stages: run.stageState.map((item) => ({ ...item })),
    approvals: run.approvals.map((item) => ({ ...item })),
    warnings: [...(run.warnings || [])],
    totals: { stages: run.stageState.length, completed, events: run.eventIds.length },
  };
}

function track(run, eventId) {
  if (eventId) run.eventIds.push(eventId);
  run.updatedAt = new Date().toISOString();
}

function findIdempotency(key) {
  return idempotency.get(String(key || "").trim()) || "";
}

function claimIdempotency(key, executionId) {
  idempotency.set(String(key || "").trim(), executionId);
}

module.exports = {
  MAX_RUNS,
  MAX_APPROVALS,
  putRun,
  getRun,
  listRuns,
  snapshot,
  track,
  findIdempotency,
  claimIdempotency,
};

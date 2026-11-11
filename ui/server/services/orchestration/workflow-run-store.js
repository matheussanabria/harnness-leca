// @ts-check
// Estado em memória das execuções de workflow e índice de idempotência (EP-08.04, EP-08.05).

const MAX_RUNS = 200;
const MAX_APPROVALS = 20;

/** @type {Map<string, any>} */
const runs = new Map();
/** @type {Map<string, string>} */
const idempotency = new Map();

let loaded = false;

/** Rehydrates runs persisted by a previous server process (once per process; never throws). */
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const fs = require("fs");
    const path = require("path");
    const { getProjects } = require("../../config");
    const { loadProjectRuns } = require("./workflow-run-persist");
    const root = getProjects();
    const found = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(...loadProjectRuns(path.join(root, entry.name), entry.name));
    }
    found.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
    for (const run of found.slice(-MAX_RUNS)) {
      if (runs.has(run.executionId)) continue;
      runs.set(run.executionId, run);
      if (run.idempotencyKey) idempotency.set(`${run.slug}:${run.workflowId}:${run.idempotencyKey}`, run.executionId);
    }
  } catch {
    /* no projects folder or unreadable: start empty */
  }
}

/** Persists the run (best effort) and returns its snapshot: use after every state change. */
function commit(run) {
  require("./workflow-run-persist").saveRunState(run);
  return snapshot(run);
}

function putRun(run) {
  ensureLoaded();
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
  ensureLoaded();
  return runs.get(String(executionId || "").trim()) || null;
}

function listRuns(slug, routineId) {
  ensureLoaded();
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
    meta: { ...(run.meta || {}) },
    totals: { stages: run.stageState.length, completed, events: run.eventIds.length },
  };
}

function track(run, eventId) {
  if (eventId) run.eventIds.push(eventId);
  run.updatedAt = new Date().toISOString();
}

function findIdempotency(key) {
  ensureLoaded();
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
  commit,
  track,
  findIdempotency,
  claimIdempotency,
};

// @ts-check
// Preparation of a workflow run: sanitized meta, resuming at a stage, dispensed stages (with the reason) and the
// next active stage. Pure functions over the run object; the runner owns the lifecycle.
const { getDispensedStages } = require("./workflow-definitions");

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function sanitizeMeta(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  return { seed: String(m.seed || "").slice(0, 2000), storyKey: String(m.storyKey || "").slice(0, 80), source: String(m.source || "").slice(0, 40) };
}

/** Resumes at `fromStage`: earlier stages are marked skipped. Unknown stage is a 400. */
function applyFromStage(run, fromStage) {
  const wanted = String(fromStage || "").trim();
  if (!wanted) return;
  const index = run.stageState.findIndex((item) => item.id === wanted);
  if (index < 0) throw fail(400, `Etapa '${wanted}' não existe neste workflow.`);
  for (let i = 0; i < index; i += 1) {
    run.stageState[i].status = "skipped";
    run.stageState[i].reason = `Retomado a partir de '${wanted}'`;
  }
  run.currentIndex = index;
}

/** Index of the next stage that is not skipped after `from`; -1 when none is left. */
function nextActiveIndex(run, from) {
  for (let i = from + 1; i < run.stageState.length; i += 1) {
    if (run.stageState[i].status !== "skipped") return i;
  }
  return -1;
}

/** Marks the stages the workflow dispenses (for the given flags) as skipped, with the reason. */
function applyDispensed(run, flags) {
  const dispensed = getDispensedStages(run.workflowId, { visual: flags?.visual === true });
  run.stageState.forEach((item, index) => {
    const reason = dispensed[item.id];
    if (reason && index >= run.currentIndex && item.status === "pending") {
      item.status = "skipped";
      item.reason = reason;
    }
  });
  if (run.stageState[run.currentIndex]?.status === "skipped") {
    const next = nextActiveIndex(run, run.currentIndex);
    if (next >= 0) run.currentIndex = next;
  }
}

module.exports = { sanitizeMeta, applyFromStage, applyDispensed, nextActiveIndex };

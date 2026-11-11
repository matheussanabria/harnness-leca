// @ts-check
// Feature dossier of a workflow run: a folder with _status.md (the stage registry) and one file per stage.
// _status.md is DECLARED evidence (EP-18): readers must not treat it as the audit store.
// Contract of the stage table: id, status (done|skipped|pending|in-progress|failed|blocked), reason, file, at.
// Every function is best effort and never throws into the workflow.
const fs = require("fs");
const path = require("path");
const { getStage } = require("./agent-stage-catalog");
const { featureSlug, resolveDossierRoot, isInside } = require("./workflow-dossier-paths");

const STATUS_FILE = "_status.md";
const DOC_FILE = /\.[a-z]+$/i;

const STATUS_MAP = Object.freeze({ completed: "done", skipped: "skipped", pending: "pending", running: "in-progress", progressed: "in-progress", failed: "failed", blocked: "blocked" });

/** First document file a stage writes ("01-story.md"); "" when it only writes code. @param {string} stageId */
function stageFile(stageId) {
  const stage = getStage(stageId);
  return (stage ? stage.writes : []).find((item) => DOC_FILE.test(item)) || "";
}

/** @param {any} run */
function dossierDir(run) {
  const slug = run?.meta?.dossierSlug;
  if (!slug || !run.projectDir) return "";
  const { root } = resolveDossierRoot(run.projectDir);
  const dir = path.join(root, slug);
  return isInside(root, dir) ? dir : "";
}

/** Dossier path as shown to the user: relative to the repo (or to the harness project). @param {any} run */
function dossierRel(run) {
  const slug = run?.meta?.dossierSlug;
  if (!slug || !run.projectDir) return "";
  return `${resolveDossierRoot(run.projectDir).rel}/${slug}`;
}

/** @param {any} run @param {number} index */
function stageRow(run, index) {
  const item = run.stageState[index];
  const attempts = Array.isArray(item.attempts) ? item.attempts : [];
  const last = attempts.length ? attempts[attempts.length - 1] : null;
  const status = STATUS_MAP[item.status] || "pending";
  const cell = (/** @type {string} */ text) => String(text || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  return `| ${cell(item.label)} (${item.id}) | ${status} | ${cell(item.reason)} | ${stageFile(item.id)} | ${last?.closedAt || last?.openedAt || ""} |`;
}

/** @param {any} run */
function renderStatus(run) {
  const meta = run.meta || {};
  const quote = (/** @type {string} */ text) => JSON.stringify(String(text || "").slice(0, 300));
  return [
    "---",
    `executionId: ${run.executionId}`,
    `workflow: ${run.workflowId}`,
    `feature: ${meta.dossierSlug || ""}`,
    `story: ${meta.storyKey || ""}`,
    `seed: ${quote(meta.seed)}`,
    `status: ${run.status}`,
    `updatedAt: ${run.updatedAt}`,
    "evidence: declared",
    "---",
    `# Dossiê: ${meta.seed || meta.dossierSlug || run.executionId}`,
    "",
    "| Etapa | Status | Motivo | Arquivo | Em |",
    "|---|---|---|---|---|",
    ...run.stageState.map((_, index) => stageRow(run, index)),
    "",
  ].join("\n");
}

/** Atomic write of _status.md. @param {string} dir @param {any} run */
function writeStatus(dir, run) {
  const target = path.join(dir, STATUS_FILE);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, renderStatus(run), "utf8");
  fs.renameSync(tmp, target);
}

/** True when the folder already holds the dossier of another execution. @param {string} dir @param {string} executionId */
function belongsToOther(dir, executionId) {
  try {
    const head = fs.readFileSync(path.join(dir, STATUS_FILE), "utf8").slice(0, 400);
    const found = /executionId:\s*(\S+)/.exec(head);
    return Boolean(found && found[1] !== executionId);
  } catch {
    return false;
  }
}

/**
 * Creates the dossier folder and _status.md; sets run.meta.dossierSlug. Returns { dir, rel } or null.
 * @param {any} run
 */
function createDossier(run) {
  try {
    const meta = (run.meta = run.meta || {});
    const { root } = resolveDossierRoot(run.projectDir);
    let slug = featureSlug({ storyKey: meta.storyKey, seed: meta.seed });
    if (belongsToOther(path.join(root, slug), run.executionId)) slug = `${slug}-${run.executionId.slice(-4)}`;
    const dir = path.join(root, slug);
    if (!isInside(root, dir)) return null;
    meta.dossierSlug = slug;
    fs.mkdirSync(dir, { recursive: true });
    writeStatus(dir, run);
    return { dir, rel: dossierRel(run) };
  } catch {
    return null;
  }
}

/** Rewrites _status.md after a state change (no-op for runs without dossier). @param {any} run */
function syncDossier(run) {
  try {
    const dir = dossierDir(run);
    if (dir && fs.existsSync(dir)) writeStatus(dir, run);
  } catch {
    /* best effort */
  }
}

/**
 * Output file of a stage inside the dossier. exists=false also when the stage writes only code.
 * @param {any} run @param {string} stageId
 * @returns {{ file: string, path: string, exists: boolean, bytes: number }}
 */
function stageOutput(run, stageId) {
  const file = stageFile(stageId);
  const dir = dossierDir(run);
  if (!file || !dir) return { file, path: "", exists: false, bytes: 0 };
  try {
    const stat = fs.statSync(path.join(dir, file));
    return { file, path: `${dossierRel(run)}/${file}`, exists: stat.isFile() && stat.size > 0, bytes: stat.size };
  } catch {
    return { file, path: `${dossierRel(run)}/${file}`, exists: false, bytes: 0 };
  }
}

/** Output files of the stages before `stageId` that already exist (what the stage should read). @param {any} run @param {string} stageId */
function previousOutputs(run, stageId) {
  const index = run.stageState.findIndex((item) => item.id === stageId);
  return run.stageState
    .slice(0, Math.max(index, 0))
    .map((item) => stageOutput(run, item.id))
    .filter((output) => output.exists && output.file !== STATUS_FILE);
}

module.exports = { STATUS_FILE, stageFile, dossierDir, dossierRel, renderStatus, createDossier, syncDossier, stageOutput, previousOutputs };

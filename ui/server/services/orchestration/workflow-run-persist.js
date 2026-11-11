// @ts-check
// Disk persistence of workflow runs: projects/<slug>/workflow-runs/<executionId>.json, one file per run.
// The in-memory store stays the source of truth while the server runs; these files let a restart
// rehydrate active runs (chat cards keep working). A failed write never breaks the workflow.
const fs = require("fs");
const path = require("path");

const DIR = "workflow-runs";
const FILE_RE = /^wf-[\w-]+\.json$/;
const stats = { writes: 0, failures: 0 };

/** @param {string} projectDir */
function runsDir(projectDir) {
  return path.join(projectDir, DIR);
}

/**
 * Atomic write (tmp + rename). Returns true on success; never throws.
 * @param {any} run
 */
function saveRunState(run) {
  if (!run?.projectDir || !run.executionId) return false;
  try {
    const dir = runsDir(run.projectDir);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${run.executionId}.json`);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(run), "utf8");
    fs.renameSync(tmp, target);
    stats.writes += 1;
    return true;
  } catch {
    stats.failures += 1;
    return false;
  }
}

/**
 * Reads every persisted run of a project; corrupt or foreign files are skipped.
 * The stored projectDir is ignored: the caller's path wins (the repository may have moved).
 * @param {string} projectDir @param {string} slug
 * @returns {any[]}
 */
function loadProjectRuns(projectDir, slug) {
  const dir = runsDir(projectDir);
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => FILE_RE.test(name));
  } catch {
    return [];
  }
  const runs = [];
  for (const name of names) {
    try {
      const run = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      const valid = run && run.executionId && Array.isArray(run.stageState) && Array.isArray(run.approvals) && Array.isArray(run.eventIds);
      if (!valid || run.slug !== slug || `${run.executionId}.json` !== name) continue;
      runs.push({ ...run, projectDir });
    } catch {
      /* corrupt file: ignored */
    }
  }
  return runs;
}

module.exports = { saveRunState, loadProjectRuns, persistStats: () => ({ ...stats }) };

// @ts-check
// Workflow runs survive a server restart: process A writes them, a fresh process B rehydrates them.
const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-wfpersist-"));
const SLUG = "projeto-persist";
const PROJECT = path.join(ROOT, "projects", SLUG);
fs.mkdirSync(PROJECT, { recursive: true });
test.after(() => removeDir(ROOT));

const RUNNER = JSON.stringify(path.join(__dirname, "..", "ui", "server", "services", "orchestration", "workflow-runner.service.js"));
const COMMAND = JSON.stringify(path.join(__dirname, "..", "ui", "server", "services", "orchestration", "workflow-command.service.js"));

/** Runs a script in a fresh node process (= a server restart) against the temp harness root. */
function node(script) {
  const env = { ...process.env, HARNESS_ROOT: ROOT };
  delete env.HARNESS_PROJECTS_DIR;
  const r = spawnSync(process.execPath, ["-e", `${script}\nprocess.exit(0);`], { env, encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim().split("\n").pop();
}

const START = (extra = "") => `
  const { startWorkflowRun, advanceWorkflowRun } = require(${RUNNER});
  const r = startWorkflowRun({ slug: ${JSON.stringify(SLUG)}, projectDir: ${JSON.stringify(PROJECT)}, workflowId: "feature-delivery", actor: "t", meta: { seed: "persistir" }${extra} });
  advanceWorkflowRun(r.run.executionId, { stageId: "start", status: "completed" });
  console.log(r.run.executionId);`;

test("an active run is rehydrated after a restart and keeps working", () => {
  const id = node(START());
  assert.ok(fs.existsSync(path.join(PROJECT, "workflow-runs", `${id}.json`)), "state file written");

  const after = JSON.parse(node(`
    const { getWorkflowRun, advanceWorkflowRun } = require(${RUNNER});
    const before = getWorkflowRun(${JSON.stringify(id)});
    const next = advanceWorkflowRun(${JSON.stringify(id)}, { stageId: "story", status: "completed" });
    console.log(JSON.stringify({ stage: before.currentStage.id, seed: before.meta.seed, status: before.status, next: next.run.currentStage.id }));`));
  assert.deepEqual(after, { stage: "story", seed: "persistir", status: "running", next: "bdd" });
});

test("the chat card can be rebuilt after a restart, and a cancelled run stays cancelled", () => {
  const id = node(START());
  const card = JSON.parse(node(`
    const { cardForExecution } = require(${COMMAND});
    const c = cardForExecution(${JSON.stringify(SLUG)}, ${JSON.stringify(PROJECT)}, ${JSON.stringify(id)});
    console.log(JSON.stringify({ stage: c.stageId, seed: c.seed, ids: c.actions.map((a) => a.id) }));`));
  assert.deepEqual(card, { stage: "story", seed: "persistir", ids: ["run", "cancel"] });

  node(`const { cancelWorkflowRun } = require(${RUNNER}); cancelWorkflowRun(${JSON.stringify(id)}, { reason: "teste" }); console.log("ok");`);
  const status = node(`const { getWorkflowRun } = require(${RUNNER}); console.log(getWorkflowRun(${JSON.stringify(id)}).status);`);
  assert.equal(status, "cancelled");
});

test("idempotency survives a restart; corrupt and foreign files are ignored", () => {
  const first = node(START(', idempotencyKey: "chave-1"'));
  fs.writeFileSync(path.join(PROJECT, "workflow-runs", "wf-corrupto.json"), "{not json", "utf8");
  fs.writeFileSync(path.join(PROJECT, "workflow-runs", "wf-outro.json"), JSON.stringify({ executionId: "wf-outro", slug: "outro-projeto", stageState: [], approvals: [], eventIds: [] }), "utf8");

  const out = JSON.parse(node(`
    const { startWorkflowRun, listWorkflowRuns } = require(${RUNNER});
    const again = startWorkflowRun({ slug: ${JSON.stringify(SLUG)}, projectDir: ${JSON.stringify(PROJECT)}, workflowId: "feature-delivery", actor: "t", idempotencyKey: "chave-1" });
    console.log(JSON.stringify({ idempotent: again.idempotent, same: again.run.executionId, ids: listWorkflowRuns(${JSON.stringify(SLUG)}).map((r) => r.executionId) }));`));
  assert.equal(out.idempotent, true);
  assert.equal(out.same, first);
  assert.equal(out.ids.includes("wf-outro"), false);
  assert.equal(out.ids.includes("wf-corrupto"), false);
});

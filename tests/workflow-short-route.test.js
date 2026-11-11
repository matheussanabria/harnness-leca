// @ts-check
// "rota-curta" workflow: small changes. Story and BDD are mandatory; modeling is always dispensed; the prototype is
// dispensed unless --visual. Dispensed stages are recorded as skipped WITH a reason, and the runner skips them.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-shortroute-"));
process.env.HARNESS_ROOT = ROOT;
const SLUG = "projeto-curto";
const projectDir = path.join(ROOT, "projects", SLUG);
const REPO = path.join(ROOT, "repo");
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(REPO, { recursive: true });
fs.writeFileSync(path.join(projectDir, "mcp.json"), JSON.stringify({ repo: REPO }));
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(ROOT);
});

const defs = require("../ui/server/services/orchestration/workflow-definitions");
const { nextActiveIndex } = require("../ui/server/services/orchestration/workflow-run-setup");
const { runWorkflowCommand, cardForExecution } = require("../ui/server/services/orchestration/workflow-command.service");
const { advanceWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");
const { approveWorkflowRun } = require("../ui/server/services/orchestration/workflow-approval.service");
const { parseWorkflowCommand } = require("../ui/server/services/orchestration/workflow-command-parser");

const start = (text) => runWorkflowCommand({ slug: SLUG, projectDir, text });
const statusOf = (rel) => fs.readFileSync(path.join(REPO, rel, "_status.md"), "utf8");
const done = (id, stageId) => advanceWorkflowRun(id, { stageId, status: "completed" }).run;

test("catalog: rota-curta lists story and BDD as required and shows the default dispensations", () => {
  const wf = defs.getWorkflow("rota-curta");
  assert.deepEqual(wf.stages.map((s) => s.id), ["start", "story", "bdd", "prototype", "modeling", "dev", "tests", "review", "commit-pr"]);
  assert.equal(wf.stages.find((s) => s.id === "modeling").dispensed.length > 0, true);
  assert.equal(wf.stages.find((s) => s.id === "prototype").dispensed.length > 0, true);
  for (const id of ["story", "bdd", "dev", "tests", "review", "commit-pr"]) assert.equal(wf.stages.find((s) => s.id === id).dispensed, "");
  assert.equal(wf.stages.some((s) => s.id === "deploy"), false, "no deploy in the short route");
  assert.deepEqual(Object.keys(defs.getDispensedStages("rota-curta")).sort(), ["modeling", "prototype"]);
  assert.deepEqual(Object.keys(defs.getDispensedStages("rota-curta", { visual: true })), ["modeling"]);
  assert.deepEqual(defs.getDispensedStages("hotfix"), {});
  assert.deepEqual(defs.getDispensedStages("feature-delivery", { visual: true }), {});
});

test("parser: --visual is a flag, --visualizar is not", () => {
  assert.equal(parseWorkflowCommand("/workflow rota-curta Ajuste --visual").visual, true);
  assert.equal(parseWorkflowCommand("/workflow rota-curta --visual Ajuste do botao").description, "Ajuste do botao");
  assert.equal(parseWorkflowCommand("/workflow rota-curta Ajuste --visualizar").visual, false);
});

test("without --visual the run skips prototype and modeling, records the reasons and completes", () => {
  const out = start("/workflow rota-curta Ajuste pequeno --story US-30");
  assert.equal(out.ok, true);
  const id = out.card.executionId;
  const status = statusOf(out.card.dossier);
  assert.match(status, /\| Protótipo \(prototype\) \| skipped \| Sem elemento visual novo/);
  assert.match(status, /\| Modelagem \(modeling\) \| skipped \| Dispensada na rota curta \(até 3 arquivos, sem tela nova, sem mudança de contrato\)/);

  assert.equal(out.card.stageId, "story");
  assert.equal(done(id, "story").currentStage.id, "bdd");
  assert.equal(done(id, "bdd").currentStage.id, "dev", "prototype and modeling are skipped over");
  assert.equal(done(id, "dev").currentStage.id, "tests");
  assert.equal(done(id, "tests").currentStage.id, "review");
  const last = done(id, "review");
  assert.equal(last.currentStage.id, "commit-pr");
  assert.equal(last.currentStage.requiresApproval, true);
  assert.throws(() => done(id, "commit-pr"), /exige aprovação/);
  approveWorkflowRun(id, { stageId: "commit-pr", decision: "approved", actor: "t" });
  assert.equal(done(id, "commit-pr").status, "completed");
  assert.match(statusOf(out.card.dossier), /status: completed/);
});

test("with --visual the prototype stays and needs approval; modeling is still dispensed", () => {
  const out = start("/workflow rota-curta Destaque tracejado --visual");
  const id = out.card.executionId;
  assert.doesNotMatch(statusOf(out.card.dossier), /Protótipo \(prototype\) \| skipped/);
  assert.match(statusOf(out.card.dossier), /Modelagem \(modeling\) \| skipped/);
  done(id, "story");
  const afterBdd = done(id, "bdd");
  assert.equal(afterBdd.currentStage.id, "prototype");
  assert.equal(afterBdd.currentStage.requiresApproval, true);
  assert.throws(() => done(id, "prototype"), /exige aprovação/);
  approveWorkflowRun(id, { stageId: "prototype", decision: "approved", actor: "t" });
  assert.equal(done(id, "prototype").currentStage.id, "dev", "modeling is skipped after the prototype");
});

test("BDD and tests prompts carry the CP-nn scenario-to-test convention; other stages do not", () => {
  const out = start("/workflow rota-curta Convencao de cenarios");
  const id = out.card.executionId;
  done(id, "story");
  const bdd = cardForExecution(SLUG, projectDir, id);
  assert.equal(bdd.stageId, "bdd");
  assert.match(bdd.stagePrompt, /CP-01, CP-02/);
  assert.match(bdd.stagePrompt, /caminho feliz, alternativo e de erro/);
  done(id, "bdd");
  done(id, "dev");
  const tests = cardForExecution(SLUG, projectDir, id);
  assert.equal(tests.stageId, "tests");
  assert.match(tests.stagePrompt, /test\("CP-02:/);
  assert.match(start("/workflow rota-curta Outra entrega").card.stagePrompt, /^(?![\s\S]*CP-01)/);
});

test("nextActiveIndex skips skipped stages and returns -1 at the end", () => {
  const run = { stageState: [{ status: "completed" }, { status: "skipped" }, { status: "skipped" }, { status: "pending" }, { status: "skipped" }] };
  assert.equal(nextActiveIndex(run, 0), 3);
  assert.equal(nextActiveIndex(run, 3), -1);
});

test("the hotfix and the full workflow keep their stages (nothing is dispensed there)", () => {
  const out = start("/workflow hotfix Correcao pontual");
  assert.doesNotMatch(statusOf(out.card.dossier), /skipped/);
  assert.equal(defs.getWorkflow("feature-delivery").stages.length, 10);
});

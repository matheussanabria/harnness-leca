// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-routine-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-teste";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  const dir = path.join(projectDir, ".agents", "skills", "bdd-scenarios");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: bdd-scenarios\ndescription: Cenarios BDD\n---\n\n# bdd-scenarios\n`);
  return projectDir;
}

const PROJECT_DIR = seedProject();

const {
  listRoutines,
  getRoutine,
  isValidRoutine,
  isDue,
  routineIdempotencyKey,
} = require("../ui/server/services/orchestration/routine-definitions");
const { listProjectRoutines, runRoutine } = require("../ui/server/services/orchestration/routine-runner.service");
const { advanceWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");
const { approveWorkflowRun, listPendingApprovals } = require("../ui/server/services/orchestration/workflow-approval.service");
const { readWorkflowHistory } = require("../ui/server/services/orchestration/workflow-history.service");
const { eventEngine } = require("../ui/server/services/orchestration/event-engine");

test("routine-definitions: catálogo, gatilhos e política de aprovação", () => {
  const routines = listRoutines();
  assert.equal(routines.length, 3);
  assert.equal(isValidRoutine("rotina-feature-delivery"), true);
  assert.equal(isValidRoutine("rotina-inexistente"), false);

  const daily = getRoutine("rotina-feature-delivery");
  assert.equal(daily.trigger.type, "daily");
  assert.equal(daily.scheduled, true);
  assert.equal(daily.workflowId, "feature-delivery");
  assert.deepEqual(daily.approvalStages, ["prototype", "commit-pr", "deploy"]);
  assert.equal(daily.sensitive, true);

  const manual = getRoutine("rotina-hotfix");
  assert.equal(manual.trigger.type, "manual");
  assert.equal(manual.scheduled, false);
  assert.equal(manual.workflowId, "hotfix");
});

test("routine-definitions: chave determinística e cálculo de vencimento", () => {
  const when = new Date(2026, 9, 21, 10, 30, 0);
  const key = routineIdempotencyKey("rotina-feature-delivery", SLUG, when);
  assert.equal(key, `routine:rotina-feature-delivery:${SLUG}:2026-10-21`);
  assert.equal(routineIdempotencyKey("rotina-feature-delivery", SLUG, when), key);

  const daily = getRoutine("rotina-feature-delivery");
  assert.equal(isDue(daily, new Date(2026, 9, 21, 8, 0, 0)), false);
  assert.equal(isDue(daily, new Date(2026, 9, 21, 9, 30, 0)), true);
  assert.equal(isDue(getRoutine("rotina-hotfix"), when), false);
});

test("routine-runner: listagem resolvida no projeto", () => {
  const result = listProjectRoutines({ slug: SLUG, projectDir: PROJECT_DIR });
  assert.equal(result.totals.total, 3);
  assert.equal(result.totals.scheduled, 1);
  const daily = result.routines.find((item) => item.id === "rotina-feature-delivery");
  assert.equal(daily.plan.workflowId, "feature-delivery");
  assert.equal(daily.plan.approvalsRequired, 3);
  assert.equal(daily.lastRun, null);
});

test("routine-runner: execução idempotente na janela e execuções manuais livres", () => {
  const first = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-feature-delivery", actor: "teste" });
  const second = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-feature-delivery", actor: "teste" });
  assert.equal(first.run.executionId, second.run.executionId);
  assert.equal(second.idempotent, true);
  assert.equal(first.run.routineId, "rotina-feature-delivery");

  const manualA = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-hotfix", actor: "teste" });
  const manualB = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-hotfix", actor: "teste" });
  assert.notEqual(manualA.run.executionId, manualB.run.executionId);
  assert.equal(manualB.idempotent, false);

  assert.throws(() => runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-inexistente" }), /Rotina desconhecida/);
});

test("routine-runner: etapa sensível exige decisão de aprovação", () => {
  const started = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-hotfix", actor: "teste" });
  const executionId = started.run.executionId;

  for (const stageId of ["start", "dev", "tests", "review"]) {
    advanceWorkflowRun(executionId, { stageId, status: "completed" });
  }

  const pending = listPendingApprovals(SLUG);
  const entry = pending.find((item) => item.executionId === executionId);
  assert.ok(entry);
  assert.equal(entry.stageId, "commit-pr");

  assert.throws(() => advanceWorkflowRun(executionId, { stageId: "commit-pr", status: "completed" }), /exige aprovação registrada/);

  const approved = approveWorkflowRun(executionId, { decision: "approved", actor: "coordenador", note: "ok" });
  assert.equal(approved.decision.decision, "approved");
  assert.equal(approved.decision.actor, "coordenador");
  assert.equal(listPendingApprovals(SLUG).some((item) => item.executionId === executionId), false);

  const advanced = advanceWorkflowRun(executionId, { stageId: "commit-pr", status: "completed" });
  assert.equal(advanced.run.status, "running");

  const events = eventEngine.history.filter((item) => item.executionId === executionId).map((item) => item.type);
  assert.equal(events.includes("execution.approval_requested"), true);
  assert.equal(events.includes("execution.approved"), true);
});

test("routine-runner: aprovação negada cancela a execução", () => {
  const started = runRoutine({ slug: SLUG, projectDir: PROJECT_DIR, routineId: "rotina-hotfix", actor: "teste" });
  const executionId = started.run.executionId;
  for (const stageId of ["start", "dev", "tests", "review"]) {
    advanceWorkflowRun(executionId, { stageId, status: "completed" });
  }
  const rejected = approveWorkflowRun(executionId, { decision: "rejected", actor: "coordenador", note: "fora de escopo" });
  assert.equal(rejected.run.status, "cancelled");
  assert.throws(() => approveWorkflowRun(executionId, { decision: "approved" }), /Execução já encerrada/);
  assert.throws(() => advanceWorkflowRun(executionId, { status: "completed" }), /Execução já encerrada/);
});

test("routine-runner: histórico persistido registra aprovação e execução", () => {
  const history = readWorkflowHistory(PROJECT_DIR, { limit: 200 });
  assert.ok(history.entries.length > 0);
  assert.equal(history.warnings.length, 0);
  const types = history.entries.map((entry) => entry.type);
  assert.equal(types.includes("execution.started"), true);
  assert.equal(types.includes("execution.approval_requested"), true);
  assert.equal(types.includes("execution.approved"), true);
  assert.equal(types.includes("execution.rejected"), true);
  const approval = history.entries.find((entry) => entry.type === "execution.approved");
  assert.equal(approval.actor, "coordenador");
  assert.equal(approval.stageId, "commit-pr");
});

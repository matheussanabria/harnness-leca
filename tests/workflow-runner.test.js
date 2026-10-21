// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-workflow-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-teste";
const LANE = "em-desenvolvimento";
const SKILL_A = "project-harness:bdd-scenarios";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  for (const [name, description] of [
    ["bdd-scenarios", "Cenarios BDD em Gherkin"],
    ["ux-design-process", "Processo de design de experiencia"],
  ]) {
    const dir = path.join(projectDir, ".agents", "skills", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  }
  return projectDir;
}

const {
  STAGE_IDS,
  listWorkflows,
  getWorkflow,
  isValidWorkflow,
} = require("../ui/server/services/orchestration/workflow-definitions");
const { buildWorkflowPlan } = require("../ui/server/services/orchestration/workflow-plan.service");
const {
  startWorkflowRun,
  advanceWorkflowRun,
  cancelWorkflowRun,
  listWorkflowRuns,
  getWorkflowRun,
} = require("../ui/server/services/orchestration/workflow-runner.service");
const { eventEngine } = require("../ui/server/services/orchestration/event-engine");
const { approveWorkflowRun } = require("../ui/server/services/orchestration/workflow-approval.service");
const { setSkillBinding } = require("../ui/server/services/skill-bindings.service");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");

const PROJECT_DIR = seedProject();
const LANES = getCanonicalLanes();

function plan() {
  return buildWorkflowPlan({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "feature-delivery" });
}

test("workflow-definitions: catálogo, ordem e políticas por etapa", () => {
  const workflows = listWorkflows();
  assert.equal(workflows.length, 2);
  assert.deepEqual(workflows.map((item) => item.id), ["feature-delivery", "hotfix"]);

  const full = getWorkflow("feature-delivery");
  assert.equal(full.stageCount, 10);
  assert.deepEqual(full.stages.map((stage) => stage.id), [...STAGE_IDS]);

  const hotfix = getWorkflow("hotfix");
  assert.equal(hotfix.stageCount, 6);
  const positions = hotfix.stages.map((stage) => full.stages.findIndex((item) => item.id === stage.id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));

  const start = full.stages.find((stage) => stage.id === "start");
  const dev = full.stages.find((stage) => stage.id === "dev");
  const prototype = full.stages.find((stage) => stage.id === "prototype");
  const review = full.stages.find((stage) => stage.id === "review");
  assert.deepEqual(start.permissions, { read: true, write: false, exec: false });
  assert.equal(dev.permissions.write, true);
  assert.equal(dev.permissions.exec, true);
  assert.equal(prototype.requiresApproval, true);
  assert.equal(review.permissions.write, false);
  assert.equal(review.requiresApproval, false);

  assert.equal(isValidWorkflow("hotfix"), true);
  assert.equal(isValidWorkflow("inexistente"), false);
  assert.equal(getWorkflow("inexistente"), null);
});

test("workflow-plan: resolve agentes, skills do projeto e faltantes", () => {
  const report = plan();
  assert.equal(report.ok, true);
  assert.equal(report.workflow.stageCount, 10);
  assert.equal(report.stages.length, 10);
  assert.equal(report.laneId, "");

  const story = report.stages.find((stage) => stage.id === "story");
  assert.equal(story.executors[0], "business-analyst");
  assert.equal(story.agents.find((agent) => agent.role === "executor").id, "business-analyst");
  assert.equal(story.requiresApproval, false);

  const bdd = report.stages.find((stage) => stage.id === "bdd");
  const scenario = bdd.skills.find((skill) => skill.name === "bdd-scenarios");
  assert.deepEqual(scenario, { name: "bdd-scenarios", key: SKILL_A, available: true, bound: true });
  const missing = bdd.skills.find((skill) => skill.name === "api-security");
  assert.equal(missing.available, false);

  assert.equal(report.totals.stages, 10);
  assert.equal(report.totals.skillsAvailable, 2);
  assert.ok(report.totals.skillsMissing > 0);
  assert.equal(report.totals.approvalsRequired, 3);
  assert.equal(report.totals.writes, 4);
  assert.ok(report.warnings.some((warning) => warning.includes("não existem no catálogo")));

  assert.throws(() => buildWorkflowPlan({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "nao-existe" }), /Workflow desconhecido/);
  assert.throws(() => buildWorkflowPlan({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", laneId: "nao-existe" }), /Raia/);
});

test("workflow-plan: restringe skills à raia informada", () => {
  setSkillBinding(PROJECT_DIR, { action: "add", laneId: LANE, skillKey: SKILL_A }, LANES, new Set([SKILL_A]));

  const bound = buildWorkflowPlan({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "feature-delivery", laneId: LANE });
  assert.equal(bound.laneId, LANE);
  const bdd = bound.stages.find((stage) => stage.id === "bdd").skills.find((skill) => skill.name === "bdd-scenarios");
  const prototype = bound.stages.find((stage) => stage.id === "prototype").skills.find((skill) => skill.name === "ux-design-process");
  assert.equal(bdd.bound, true);
  assert.equal(prototype.bound, false);
  assert.equal(bound.totals.skillsUnbound, 1);
  assert.ok(bound.warnings.some((warning) => warning.includes("não estão vinculadas")));
});

test("workflow-runner: inicia, avança em ordem e conclui com eventos", () => {
  const started = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", actor: "teste" });
  assert.equal(started.ok, true);
  assert.equal(started.dryRun, false);
  assert.equal(started.run.status, "running");
  assert.equal(started.run.totals.stages, 6);
  assert.equal(started.run.currentStage.id, "start");

  const executionId = started.run.executionId;
  const created = eventEngine.getEvents({ executionId, limit: 50 }).map((event) => event.type);
  assert.equal(created[0], "execution.started");
  assert.equal(created.filter((type) => type === "task.created").length, 6);
  assert.equal(eventEngine.getEvents({ executionId, type: "execution.started" }).length, 1);

  const first = advanceWorkflowRun(executionId, { stageId: "start", status: "completed" });
  assert.equal(first.run.currentStage.id, "dev");
  assert.equal(first.run.totals.completed, 1);

  const progressed = advanceWorkflowRun(executionId, { status: "progressed", note: "codando" });
  assert.equal(progressed.run.stages.find((stage) => stage.id === "dev").status, "progressed");

  assert.throws(() => advanceWorkflowRun(executionId, { stageId: "tests", status: "completed" }), /fora de ordem/);
  assert.throws(() => advanceWorkflowRun(executionId, { status: "invalido" }), /Status de etapa inválido/);

  for (const stage of ["dev", "tests", "review", "commit-pr", "deploy"]) {
    // Etapas sensíveis exigem decisão de aprovação registrada (EP-08.05).
    if (stage === "commit-pr" || stage === "deploy") {
      approveWorkflowRun(executionId, { decision: "approved", actor: "teste" });
    }
    advanceWorkflowRun(executionId, { stageId: stage, status: "completed" });
  }

  const done = getWorkflowRun(executionId);
  assert.equal(done.status, "completed");
  assert.equal(done.totals.completed, 6);
  assert.equal(done.currentStage, null);
  assert.ok(done.finishedAt);
  const types = eventEngine.getEvents({ executionId, limit: 50 }).map((event) => event.type);
  assert.equal(types.includes("execution.completed"), true);
  assert.equal(types.includes("task.progressed"), true);
  assert.equal(types.includes("execution.approval_requested"), true);
  assert.equal(types.includes("execution.approved"), true);

  assert.throws(() => advanceWorkflowRun(executionId, { status: "completed" }), /já encerrada/);
  assert.equal(listWorkflowRuns(SLUG).some((run) => run.executionId === executionId), true);
  assert.equal(listWorkflowRuns("outro-projeto").some((run) => run.executionId === executionId), false);
});

test("workflow-runner: dryRun, bloqueio, falha e cancelamento", () => {
  const before = eventEngine.getEvents({ projectId: SLUG, limit: 200 }).length;
  const dry = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.run, undefined);
  assert.equal(dry.plan.stages.length, 6);
  assert.equal(eventEngine.getEvents({ projectId: SLUG, limit: 200 }).length, before);

  const blockedRun = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix" });
  const blockedId = blockedRun.run.executionId;
  const resumed = advanceWorkflowRun(blockedId, { status: "blocked", note: "aguardando aprovação" });
  assert.equal(resumed.run.status, "blocked");
  advanceWorkflowRun(blockedId, { status: "completed" });
  assert.equal(getWorkflowRun(blockedId).status, "running");

  const failed = advanceWorkflowRun(blockedId, { status: "failed", note: "build quebrou" });
  assert.equal(failed.run.status, "failed");
  assert.equal(failed.run.stages.find((stage) => stage.id === "dev").status, "failed");
  const failedTypes = eventEngine.getEvents({ executionId: blockedId, limit: 50 }).map((event) => event.type);
  assert.equal(failedTypes.includes("task.blocked"), true);
  assert.equal(failedTypes.includes("task.failed"), true);
  assert.equal(failedTypes.includes("execution.failed"), true);

  const cancelledRun = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix" });
  const cancelledId = cancelledRun.run.executionId;
  const cancelled = cancelWorkflowRun(cancelledId, { reason: "mudou a prioridade" });
  assert.equal(cancelled.run.status, "cancelled");
  assert.equal(eventEngine.getEvents({ executionId: cancelledId, type: "execution.cancelled" }).length, 1);
  assert.throws(() => cancelWorkflowRun(cancelledId), /já encerrada/);

  assert.throws(() => advanceWorkflowRun("wf-inexistente", { status: "started" }), /não encontrada/);
  assert.throws(() => cancelWorkflowRun("wf-inexistente"), /não encontrada/);
});

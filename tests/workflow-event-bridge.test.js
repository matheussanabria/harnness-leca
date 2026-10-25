// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-wf-bridge-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-ponte";
const PROJECT_DIR = path.join(TMP_ROOT, "projects", SLUG);
fs.mkdirSync(PROJECT_DIR, { recursive: true });

const { startWorkflowRun, advanceWorkflowRun, cancelWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");
const { approveWorkflowRun } = require("../ui/server/services/orchestration/workflow-approval.service");
const { emitWorkflowEvent } = require("../ui/server/services/orchestration/workflow-events");
const { createEvent } = require("../ui/server/services/orchestration/event-contract");
const { readEvents, closeStore } = require("../ui/server/services/events/event-store");
const bridge = require("../ui/server/services/orchestration/workflow-event-bridge");

function stored(executionId, type) {
  return readEvents(SLUG, { limit: 500 }).events.filter((e) => e.executionId === executionId && (!type || e.type === type));
}

function start() {
  return startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", actor: "teste" }).run.executionId;
}

test("ponte: start e criacao de etapas chegam ao store com o envelope esperado", () => {
  const executionId = start();
  const [started] = stored(executionId, "execution.started");
  assert.equal(started.runId, executionId);
  assert.equal(started.workflowRunId, executionId);
  assert.equal(started.projectId, SLUG);
  assert.equal(started.relation, "declared");
  assert.equal(started.source.provider, "harness");
  assert.equal(started.idempotencyKey, `wf|${executionId}|execution.started|-`);
  assert.ok(!Number.isNaN(Date.parse(started.at)));
  const created = stored(executionId, "task.created");
  assert.equal(created.length, 6);
  assert.equal(created[0].taskId, "stage:start");
  assert.equal(created[0].stepRunId, `${executionId}:stage:start`);
});

test("ponte: transicao de etapa, aprovacao e conclusao sao persistidas", () => {
  const executionId = start();
  advanceWorkflowRun(executionId, { stageId: "start", status: "completed" });
  advanceWorkflowRun(executionId, { status: "progressed", note: "x" });
  assert.equal(stored(executionId, "task.completed")[0].stepRunId, `${executionId}:stage:start`);
  assert.equal(stored(executionId, "task.progressed")[0].taskId, "stage:dev");
  for (const stage of ["dev", "tests", "review", "commit-pr", "deploy"]) {
    if (stage === "commit-pr" || stage === "deploy") approveWorkflowRun(executionId, { decision: "approved", actor: "teste" });
    advanceWorkflowRun(executionId, { stageId: stage, status: "completed" });
  }
  assert.equal(stored(executionId, "execution.approval_requested").length, 2);
  const approved = stored(executionId, "execution.approved");
  assert.equal(approved.length, 2);
  assert.equal(approved[0].stepRunId, `${executionId}:stage:commit-pr`);
  // execution.completed e gravado com o alias canonico do EP-09.
  assert.equal(stored(executionId, "execution.succeeded").length, 1);
});

test("ponte: cancelamento e persistido", () => {
  const executionId = start();
  cancelWorkflowRun(executionId, { reason: "teste" });
  const [cancelled] = stored(executionId, "execution.cancelled");
  assert.equal(cancelled.payload.reason, "teste");
  assert.equal(cancelled.runId, executionId);
});

test("ponte: replay da mesma emissao e no-op (mesmo evento e novo id com mesma chave)", () => {
  const event = createEvent({
    type: "execution.cancelled",
    source: { kind: "native", provider: "harness", confidence: "explicit" },
    projectId: SLUG,
    executionId: "exec-replay",
    payload: {},
  });
  assert.equal(bridge.bridgeWorkflowEvent(event), true);
  bridge.bridgeWorkflowEvent(event);
  bridge.bridgeWorkflowEvent({ ...event, id: "outro-id", timestamp: new Date(Date.now() + 5000).toISOString() });
  assert.equal(stored("exec-replay").length, 1);

  const p1 = { ...event, type: "task.progressed", taskId: "stage:dev", id: "p1" };
  const p2 = { ...p1, id: "p2", timestamp: new Date(Date.now() + 9000).toISOString() };
  bridge.bridgeWorkflowEvent(p1);
  bridge.bridgeWorkflowEvent(p1);
  bridge.bridgeWorkflowEvent(p2);
  assert.equal(stored("exec-replay", "task.progressed").length, 2);
});

test("ponte: falha do store nao quebra o runner, e contada e logada uma vez", () => {
  bridge.resetBridgeStats();
  const bad = "projeto-quebrado";
  fs.mkdirSync(path.join(TMP_ROOT, "projects", bad), { recursive: true });
  fs.writeFileSync(path.join(TMP_ROOT, "projects", bad, "coordination"), "arquivo, nao diretorio");
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const id1 = emitWorkflowEvent({ type: "execution.started", projectId: bad, executionId: "exec-x", payload: {} });
    const id2 = emitWorkflowEvent({ type: "execution.cancelled", projectId: bad, executionId: "exec-x", payload: {} });
    assert.ok(id1 && id2, "o feed em memoria continua funcionando");
  } finally {
    console.warn = original;
  }
  assert.equal(bridge.getBridgeStats().failed, 2);
  assert.equal(warnings.length, 1);
  assert.ok(!warnings[0].includes(TMP_ROOT), "o log nao vaza caminhos");
});

test("ponte: slug ausente ou invalido e ignorado sem falha", () => {
  bridge.resetBridgeStats();
  emitWorkflowEvent({ type: "execution.started", executionId: "exec-y", payload: {} });
  emitWorkflowEvent({ type: "execution.started", projectId: "../fora", executionId: "exec-y", payload: {} });
  assert.deepEqual(bridge.getBridgeStats(), { persisted: 0, duplicated: 0, skipped: 2, failed: 0 });
});

test("ponte: mapeamento de confianca para relation e campos de correlacao", () => {
  assert.equal(bridge.relationFor("explicit"), "declared");
  assert.equal(bridge.relationFor("observed"), "native");
  assert.equal(bridge.relationFor("inferred"), "inferred");
  assert.equal(bridge.relationFor("unknown"), "unknown");
  assert.equal(bridge.relationFor("qualquer-outra"), "unknown");

  emitWorkflowEvent({
    type: "task.started", projectId: SLUG, executionId: "exec-u", taskId: "stage:dev", agentId: "dev-1",
    confidence: "unknown", parentExecutionId: "exec-pai", correlationId: "corr-1", payload: {},
  });
  const [row] = stored("exec-u");
  assert.equal(row.relation, "unknown");
  assert.equal(row.parentRunId, "exec-pai");
  assert.equal(row.traceId, "corr-1");
  assert.equal(row.agentId, "dev-1");
});

// @ts-check
// Integration test (T4.1c): attempts reach the EP-09 store through the bridge,
// replay is a no-op, note text stays out of the stored events and old-style
// advance bodies keep working through the loopback HTTP controller.
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-attempt-ev-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-attempt-events";
const SENTINEL = "SENTINEL-leca-4f1c-note";
const SENTINEL_NOTE = `${SENTINEL} build quebrou o teste`;
const PROJECT_DIR = path.join(TMP_ROOT, "projects", SLUG);
fs.mkdirSync(PROJECT_DIR, { recursive: true });

const { startWorkflowRun, advanceWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");
const { eventEngine } = require("../ui/server/services/orchestration/event-engine");
const { readEvents, closeStore } = require("../ui/server/services/events/event-store");
const bridge = require("../ui/server/services/orchestration/workflow-event-bridge");
const { createEvent } = require("../ui/server/services/orchestration/event-contract");
const { apiProjectWorkflowRun } = require("../ui/server/controllers/orchestration-workflows.controller");
const { apiOrchestrationWorkflowRunAdvance } = require("../ui/server/controllers/orchestration-workflow-runs.controller");

let firstExecutionId = "";

test.after(() => {
  closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function stored(type, executionId) {
  return readEvents(SLUG, { limit: 2000 }).events
    .filter((event) => (!type || event.type === type) && (!executionId || event.executionId === executionId));
}

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq(body) {
  const req = Readable.from([JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: "127.0.0.1" };
  // @ts-ignore
  req.headers = {};
  return req;
}

function json(res) {
  return JSON.parse(res.body);
}

test("attempt-events: eventos task.* chegam ao store com attempt_id e payload coerente", () => {
  const started = startWorkflowRun({
    slug: SLUG,
    projectDir: PROJECT_DIR,
    workflowId: "hotfix",
    actor: "teste",
    allowRetryAfterFailure: true,
  });
  const executionId = started.run.executionId;
  firstExecutionId = executionId;

  advanceWorkflowRun(executionId, { status: "started", sessionId: "sess-attempt-1:X" });
  advanceWorkflowRun(executionId, { status: "failed", note: SENTINEL_NOTE });
  advanceWorkflowRun(executionId, { status: "started" });
  advanceWorkflowRun(executionId, { status: "completed", validation: { status: "passed", criterionId: "c-hotfix", evidenceRef: "ev-1" } });

  const storedStarted = stored("task.started", executionId);
  assert.equal(storedStarted.length, 2);
  for (const row of storedStarted) {
    assert.equal(row.attemptId, row.payload.attemptId);
    assert.match(String(row.attemptId || ""), /^att-/);
    assert.equal(row.workflowRunId, executionId);
    assert.equal(row.stepRunId, `${executionId}:stage:start`);
  }
  assert.equal(stored("execution.failed", executionId).length, 0, "o retry opt-in nao encerra a execucao");
  const [taskFailed] = stored("task.failed", executionId);
  assert.equal(taskFailed.attemptId, storedStarted[0].attemptId);
  assert.equal(taskFailed.payload.attemptNo, 1);
  const [completed] = stored("task.completed", executionId);
  assert.notEqual(completed.attemptId, taskFailed.attemptId);
  assert.deepEqual(completed.payload.validation, { status: "passed", criterionId: "c-hotfix", evidenceRef: "ev-1" });
  assert.equal(storedStarted[0].payload.declaredSessionId, "sess-attempt-1:X");
  assert.equal(taskFailed.payload.declaredSessionId, undefined);
});

test("attempt-events: replay da mesma emissao e no-op e duas tentativas nao colidem", () => {
  const base = createEvent({
    type: "task.completed",
    source: { kind: "native", provider: "harness", confidence: "explicit" },
    projectId: SLUG,
    executionId: "exec-attempt-replay",
    taskId: "stage:dev",
    payload: { attemptId: "att-replay-a", attemptNo: 1, validation: { status: "passed" } },
  });
  assert.equal(bridge.bridgeWorkflowEvent(base), true);
  assert.equal(bridge.bridgeWorkflowEvent({ ...base, id: "outro-id", timestamp: new Date(Date.now() + 5000).toISOString() }), true);
  assert.equal(stored("task.completed", "exec-attempt-replay").length, 1);

  const other = {
    ...base,
    id: "mais-um-id",
    timestamp: base.timestamp,
    payload: { attemptId: "att-replay-b", attemptNo: 2 },
  };
  assert.equal(bridge.bridgeWorkflowEvent(other), true);
  const rows = stored("task.completed", "exec-attempt-replay");
  assert.equal(rows.length, 2, "attemptId entra na chave: a tentativa 2 nao vira duplicata");
  assert.deepEqual(rows.map((row) => row.attemptId).sort(), ["att-replay-a", "att-replay-b"]);
});

test("attempt-events: texto do note nao e publicado em nenhum evento guardado", () => {
  const all = stored();
  assert.ok(all.length > 0);
  for (const row of all) {
    const rowText = JSON.stringify(row);
    assert.equal(rowText.includes(SENTINEL), false, `sentinela vazou no evento ${row.type}`);
    assert.equal(rowText.includes("build quebrou o teste"), false);
  }
  for (const row of stored(undefined, firstExecutionId)) {
    if (["task.started", "task.progressed", "task.blocked", "task.completed", "task.failed"].includes(row.type)) {
      assert.equal(row.payload.note, undefined);
      assert.equal(typeof row.payload.noteLength, "number");
    }
  }
  const failed = stored("task.failed", firstExecutionId).map((row) => row.payload.noteLength);
  assert.deepEqual(failed, [SENTINEL_NOTE.length]);
});

test("attempt-events: corpo antigo {stageId, status, note} funciona pelo controller HTTP", async () => {
  const startRes = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ actor: "http" }), res: startRes, params: [SLUG, "hotfix"] });
  assert.equal(startRes.status, 200);
  const executionId = json(startRes).run.executionId;

  const legacyFirst = fakeRes();
  await apiOrchestrationWorkflowRunAdvance({ req: fakeReq({ stageId: "start", status: "completed", note: "ok" }), res: legacyFirst, params: [executionId] });
  assert.equal(legacyFirst.status, 200);
  assert.equal(json(legacyFirst).run.currentStage.id, "dev");
  assert.equal(json(legacyFirst).run.totals.completed, 1);

  const oldOnly = fakeRes();
  await apiOrchestrationWorkflowRunAdvance({ req: fakeReq({ status: "progressed", note: "codando sem campos novos" }), res: oldOnly, params: [executionId] });
  assert.equal(oldOnly.status, 200);
  assert.equal(json(oldOnly).ok, true);
});

test("attempt-events: falha mantem o texto em memoria e projecao, mas persiste so o tamanho", () => {
  const started = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", actor: "review" });
  const executionId = started.run.executionId;
  advanceWorkflowRun(executionId, { status: "started" });
  advanceWorkflowRun(executionId, { status: "failed", note: SENTINEL_NOTE });

  const memory = (type) => eventEngine.getEvents({ executionId, type, limit: 200 });
  const [memTaskFailed] = memory("task.failed");
  const [memExecutionFailed] = memory("execution.failed");
  assert.equal(memTaskFailed.payload.error, SENTINEL_NOTE);
  assert.equal(memExecutionFailed.payload.error, SENTINEL_NOTE);

  const projected = eventEngine.getState(SLUG).executions.find((execution) => execution.id === executionId);
  assert.equal(projected.error, SENTINEL_NOTE);
  const projectedTask = projected.tasks.find((task) => task.id === memTaskFailed.taskId);
  assert.equal(projectedTask.error, SENTINEL_NOTE);

  for (const type of ["task.failed", "execution.failed"]) {
    const [row] = stored(type, executionId);
    assert.equal(JSON.stringify(row.payload).includes(SENTINEL), false, `texto vazou no ${type} persistido`);
    assert.equal(row.payload.error, undefined);
    assert.equal(row.payload.note, undefined);
    assert.equal(row.payload.errorLength, SENTINEL_NOTE.length);
  }
});

test("attempt-events: opcao allowRetryAfterFailure aceita so booleano true", async () => {
  const badRes = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ actor: "http2", allowRetryAfterFailure: "sim" }), res: badRes, params: [SLUG, "hotfix"] });
  assert.equal(badRes.status, 200);
  advanceWorkflowRun(json(badRes).run.executionId, { status: "started" });
  const failedLegacy = advanceWorkflowRun(json(badRes).run.executionId, { status: "failed" });
  assert.equal(failedLegacy.run.status, "failed", "valor nao-booleano e ignorado com seguranca");

  const goodRes = fakeRes();
  await apiProjectWorkflowRun({ req: fakeReq({ actor: "http3", allowRetryAfterFailure: true }), res: goodRes, params: [SLUG, "hotfix"] });
  assert.equal(goodRes.status, 200);
  const goodId = json(goodRes).run.executionId;
  advanceWorkflowRun(goodId, { status: "started" });
  const retried = advanceWorkflowRun(goodId, { status: "failed" });
  assert.equal(retried.run.status, "running", "opt-in verdadeiro habilita o retry");
});

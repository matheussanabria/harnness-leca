// @ts-check
// Unit tests of the attempt model (T4.1c): open/close rules, idempotency,
// retry after failure (opt-in), validation defaults and session id handling.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-attempt-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const { closeStore } = require("../ui/server/services/events/event-store");
test.after(() => {
  closeStore(SLUG);
  removeDir(TMP_ROOT);
});

const SLUG = "projeto-attempt";
const PROJECT_DIR = path.join(TMP_ROOT, "projects", SLUG);
fs.mkdirSync(PROJECT_DIR, { recursive: true });

const attempts = require("../ui/server/services/orchestration/workflow-attempt.service");
const { startWorkflowRun, advanceWorkflowRun, cancelWorkflowRun } = require("../ui/server/services/orchestration/workflow-runner.service");
const { eventEngine } = require("../ui/server/services/orchestration/event-engine");

// Pure fake run in the same shape the runner keeps internally (stageState).
function fakeRun(stageIds) {
  return { stageState: stageIds.map((id) => ({ id, label: id, status: "pending" })) };
}

function eventsOf(executionId, type) {
  return eventEngine.getEvents({ executionId, type, limit: 200 });
}

function payloadsOf(executionId, type) {
  return eventsOf(executionId, type).map((event) => event.payload);
}

function start(options = {}) {
  const result = startWorkflowRun({ slug: SLUG, projectDir: PROJECT_DIR, workflowId: "hotfix", actor: "teste", ...options });
  return { executionId: result.run.executionId, run: result.run };
}

test("attempt: openAttempt abre na primeira vez e retorna o estado correto", () => {
  const run = fakeRun(["start"]);
  assert.equal(attempts.currentAttempt(run, "start"), null);
  const open = attempts.openAttempt(run, "start");
  assert.match(open.attemptId, /^att-/);
  assert.equal(open.attemptId.length, 40);
  assert.equal(open.attemptNo, 1);
  const current = attempts.currentAttempt(run, "start");
  assert.equal(current.attemptId, open.attemptId);
  assert.equal(current.attemptNo, 1);
});

test("attempt: started repetido com tentativa aberta e idempotente (nao abre a segunda)", () => {
  const run = fakeRun(["start"]);
  const first = attempts.openAttempt(run, "start");
  const again = attempts.openAttempt(run, "start");
  assert.equal(again.attemptId, first.attemptId);
  assert.equal(again.attemptNo, 1);
  assert.equal(attempts.currentAttempt(run, "start").attemptNo, 1);
});

test("attempt: restart apos blocked e closeAttempt devolvem tentativa 2 e null", () => {
  const run = fakeRun(["start"]);
  const first = attempts.openAttempt(run, "start");
  const closed = attempts.closeAttempt(run, "start", "blocked");
  assert.equal(closed.attemptId, first.attemptId);
  assert.equal(closed.outcome, undefined);
  assert.equal(attempts.currentAttempt(run, "start"), null);

  const second = attempts.openAttempt(run, "start");
  assert.equal(second.attemptNo, 2);
  assert.notEqual(second.attemptId, first.attemptId);

  const attemptsLog = run.stageState[0].attempts;
  assert.deepEqual(attemptsLog.map((item) => item.attemptNo), [1]);
  assert.equal(attemptsLog[0].outcome, "blocked");

  for (const outcome of ["completed", "failed", "cancelled"]) {
    const other = fakeRun([outcome]);
    attempts.openAttempt(other, outcome);
    attempts.closeAttempt(other, outcome, outcome);
    assert.equal(attempts.currentAttempt(other, outcome), null);
  }
});

test("attempt: declareSession ignorado se invalido e gravado se valido", () => {
  const run = fakeRun(["start"]);
  attempts.openAttempt(run, "start");
  assert.equal(attempts.declareSession(run, "start", "sess id invalida"), "");
  assert.equal(attempts.declareSession(run, "start", `${"a".repeat(101)}`), "");
  assert.equal(attempts.currentAttempt(run, "start").declaredSessionId, "");

  const session = "sess-valid:abc._-1";
  assert.equal(attempts.declareSession(run, "start", session), session);
  assert.equal(attempts.currentAttempt(run, "start").declaredSessionId, session);
  attempts.closeAttempt(run, "start", "completed");
  assert.equal(attempts.declareSession(run, "start", session), "", "tentativa fechada guarda mais nada");
});

test("attempt: decorate enche o payload com attemptId, attemptNo e declaredSessionId", () => {
  const run = fakeRun(["start"]);
  const base = { title: "start", order: 0, noteLength: 3 };
  const decorated = attempts.decorate(run, "start", base, "sess-x");
  assert.equal(decorated.title, "start");
  assert.equal(decorated.noteLength, 3);
  assert.equal(decorated.attemptNo, 1);
  assert.match(decorated.attemptId, /^att-/);
  assert.equal(decorated.declaredSessionId, "sess-x");
  assert.equal(attempts.decorate(run, "start", base, "ruim!").declaredSessionId, undefined, "idempotente nao muda o attempt");
  assert.equal(attempts.decorate(run, "start", base, "sess-x").attemptId, decorated.attemptId);
  assert.deepEqual(attempts.decorate(null, "start", base, null), base, "run sem etapa nao abre nada");
});

test("attempt: normalizeValidation nunca rejeita e sanitiza valores", () => {
  assert.deepEqual(attempts.normalizeValidation(undefined), { status: "not_evaluated", criterionId: null, evidenceRef: null });
  assert.deepEqual(attempts.normalizeValidation("texto"), { status: "not_evaluated", criterionId: null, evidenceRef: null });
  assert.deepEqual(attempts.normalizeValidation({ status: "hacked" }), { status: "not_evaluated", criterionId: null, evidenceRef: null });
  assert.deepEqual(
    attempts.normalizeValidation({ status: "passed", criterionId: "c-1", evidenceRef: "e-1" }),
    { status: "passed", criterionId: "c-1", evidenceRef: "e-1" },
  );
  assert.deepEqual(
    attempts.normalizeValidation({ status: "failed", criterionId: 42, evidenceRef: { object: true } }),
    { status: "failed", criterionId: "42", evidenceRef: null },
  );
  assert.equal(attempts.normalizeValidation({ evidenceRef: "x".repeat(130) }).evidenceRef.length, 120);
});

test("attempt: primeira abertura na etapa tem attemptNo 1 no evento task.started", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { stageId: "start", status: "started" });
  const [payload] = payloadsOf(executionId, "task.started");
  assert.match(payload.attemptId, /^att-/);
  assert.equal(payload.attemptNo, 1);
  assert.equal(payload.noteLength, 0);
  assert.equal(payload.note, undefined);
  const second = payloadsOf(executionId, "task.started")[1];
  assert.equal(second, undefined);
});

test("attempt: started repetido pela execucao nao abre a segunda tentativa", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { status: "started" });
  advanceWorkflowRun(executionId, { status: "started" });
  const payloads = payloadsOf(executionId, "task.started");
  assert.equal(payloads.length, 2);
  for (const payload of payloads) {
    assert.equal(payload.attemptNo, 1);
    assert.equal(payload.attemptId, payloads[0].attemptId);
  }
});

test("attempt: restart apos blocked abre a tentativa 2 nos eventos", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { status: "started" });
  advanceWorkflowRun(executionId, { status: "blocked", note: "aguardando" });
  advanceWorkflowRun(executionId, { status: "started" });
  const started = payloadsOf(executionId, "task.started");
  assert.deepEqual(started.map((payload) => payload.attemptNo), [1, 2]);
  assert.notEqual(started[1].attemptId, started[0].attemptId);
  assert.equal(eventsOf(executionId, "task.blocked").length, 1);
  assert.equal(attempts.currentAttempt(null, "start"), null);
});

test("attempt: failed sem a opcao encerra a execucao como antes", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { status: "started" });
  const failed = advanceWorkflowRun(executionId, { status: "failed", note: "build quebrou" });
  assert.equal(failed.run.status, "failed");
  assert.ok(failed.run.finishedAt);
  assert.equal(eventsOf(executionId, "execution.failed").length, 1);
  assert.equal(payloadsOf(executionId, "task.failed")[0].attemptNo, 1);
  assert.throws(() => advanceWorkflowRun(executionId, { status: "started" }), /já encerrada/);
});

test("attempt: failed com allowRetryAfterFailure mantem a execucao e permite a tentativa 2", () => {
  const { executionId } = start({ allowRetryAfterFailure: true });
  advanceWorkflowRun(executionId, { status: "started" });
  const afterFailure = advanceWorkflowRun(executionId, { status: "failed", note: "teste falhou" });
  assert.equal(afterFailure.run.status, "running");
  assert.equal(afterFailure.run.finishedAt, "");
  assert.equal(eventsOf(executionId, "execution.failed").length, 0);
  assert.equal(payloadsOf(executionId, "task.failed")[0].attemptNo, 1);

  const retried = advanceWorkflowRun(executionId, { status: "started" });
  const started = payloadsOf(executionId, "task.started");
  assert.deepEqual(started.map((payload) => payload.attemptNo).sort(), [1, 2]);
  assert.deepEqual([...new Set(started.map((payload) => payload.attemptId))].length, 2);
  assert.equal(retried.run.stages.find((stage) => stage.id === "start").status, "running");

  const reject = start({ allowRetryAfterFailure: "sim" });
  advanceWorkflowRun(reject.executionId, { status: "started" });
  const legacy = advanceWorkflowRun(reject.executionId, { status: "failed" });
  assert.equal(legacy.run.status, "failed", "valor nao-booleano cai no default");
});

test("attempt: validacao padrao e copia de valores validos no task.completed", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { stageId: "start", status: "completed" });
  advanceWorkflowRun(executionId, { stageId: "dev", status: "completed", validation: { status: "passed", criterionId: "c1", evidenceRef: "e1" } });
  const validations = payloadsOf(executionId, "task.completed").map((payload) => payload.validation);
  assert.deepEqual(validations, [
    { status: "not_evaluated", criterionId: null, evidenceRef: null },
    { status: "passed", criterionId: "c1", evidenceRef: "e1" },
  ]);
});

test("attempt: sessionId valido e gravado no payload; invalido e ignorado", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { status: "started", sessionId: "sess id invalida" });
  const started = payloadsOf(executionId, "task.started")[0];
  assert.equal(started.declaredSessionId, undefined);

  const valid = "sess-valid:abc._-1";
  const progressed = advanceWorkflowRun(executionId, { status: "progressed", sessionId: valid });
  assert.equal(payloadsOf(executionId, "task.progressed")[0].declaredSessionId, valid);
  assert.equal(payloadsOf(executionId, "task.progressed")[0].attemptNo, 1);
});

test("attempt: cancelamento fecha a tentativa aberta e SESSION_PATTERN valida", () => {
  const { executionId } = start();
  advanceWorkflowRun(executionId, { status: "started" });
  const cancelled = cancelWorkflowRun(executionId, { reason: "prioridade" });
  assert.equal(cancelled.run.status, "cancelled");
  assert.equal(eventsOf(executionId, "execution.cancelled").length, 1);

  assert.equal(attempts.SESSION_PATTERN.test("sess-1:abc._-"), true);
  assert.equal(attempts.SESSION_PATTERN.test("espaco dentro"), false);
  assert.equal(attempts.SESSION_PATTERN.test("x".repeat(101)), false);
  assert.equal(attempts.SESSION_PATTERN.test(""), false);
  assert.deepEqual(attempts.openAttempt(null, "x"), { attemptId: "", attemptNo: 0 });
  assert.equal(attempts.closeAttempt(null, "x", "completed"), null);
});

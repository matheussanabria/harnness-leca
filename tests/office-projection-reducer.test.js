// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEvent,
  deriveEngineStates,
  ERROR_TTL_MS,
  rejectionOf,
  sessionsFromProjection,
  STALE_RUNNING_MS
} from "../ui/public/js/office/office-projection-reducer.js";

const ENGINES = ["claude", "gemini", "opencode"];
const T0 = Date.parse("2026-10-24T10:00:00.000Z");
const at = (offsetMs) => new Date(T0 + offsetMs).toISOString();

/** Evento mínimo no formato do envelope canônico. */
const ev = (type, sessionId, executionId, offset, payload = {}) => ({ type, sessionId, executionId, at: at(offset), payload });

function startRun(sessions, id, engine, offset = 0) {
  applyEvent(sessions, ev("session.discovered", id, id, offset, { provider: engine }));
  applyEvent(sessions, ev("execution.started", id, id, offset + 1, { engine }));
}

test("reducer: two Claude runs, one finishes, engine stays streaming with count 1", () => {
  const sessions = new Map();
  startRun(sessions, "r1", "claude");
  startRun(sessions, "r2", "claude", 10);
  let out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["streaming", 2]);

  applyEvent(sessions, ev("execution.succeeded", "r1", "r1", 50));
  out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["streaming", 1]);
  assert.equal(out.gemini.status, "idle");

  applyEvent(sessions, ev("execution.cancelled", "r2", "r2", 60));
  out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["idle", 0]);
});

test("reducer: error never hides a running execution and expires", () => {
  const sessions = new Map();
  startRun(sessions, "ok", "claude");
  startRun(sessions, "bad", "claude", 5);
  applyEvent(sessions, ev("execution.failed", "bad", "bad", 20));
  let out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["streaming", 1]);

  applyEvent(sessions, ev("execution.succeeded", "ok", "ok", 30));
  out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.equal(out.claude.status, "error");
  out = deriveEngineStates(sessions, { now: T0 + ERROR_TTL_MS + 1000, engines: ENGINES });
  assert.equal(out.claude.status, "idle");
});

test("reducer: compare mode counts each engine; waiting_approval wins over streaming", () => {
  const sessions = new Map();
  startRun(sessions, "c1", "claude");
  startRun(sessions, "g1", "gemini");
  applyEvent(sessions, ev("attention.opened", "g1", "g1", 5));
  const out = deriveEngineStates(sessions, { now: T0 + 100, engines: ENGINES });
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["streaming", 1]);
  assert.deepEqual([out.gemini.status, out.gemini.activeCount], ["waiting_approval", 1]);
});

test("reducer: terminal state does not regress on a late execution.started", () => {
  const sessions = new Map();
  startRun(sessions, "r1", "claude");
  applyEvent(sessions, ev("execution.succeeded", "r1", "r1", 10));
  applyEvent(sessions, ev("execution.started", "r1", "r1", 2));
  assert.equal(sessions.get("r1").status, "succeeded");
});

test("reducer: orphan running execution (server restarted mid-run) goes stale", () => {
  const sessions = sessionsFromProjection({
    sessions: [{ sessionId: "x", provider: "claude", executionStatus: "running", lastEventAt: at(0), attentionStatus: null }]
  });
  assert.equal(deriveEngineStates(sessions, { now: T0 + 1000, engines: ENGINES }).claude.activeCount, 1);
  assert.equal(deriveEngineStates(sessions, { now: T0 + STALE_RUNNING_MS + 1000, engines: ENGINES }).claude.activeCount, 0);
});

test("reducer: snapshot running session finishes via later event (resumed session, new runId)", () => {
  const sessions = sessionsFromProjection({
    sessions: [{ sessionId: "native-1", provider: "claude", executionStatus: "running", lastEventAt: at(0) }]
  });
  applyEvent(sessions, ev("execution.succeeded", "native-1", "run-a", 5));
  assert.equal(deriveEngineStates(sessions, { now: T0 + 10, engines: ENGINES }).claude.activeCount, 0);
});

test("reducer: 429 rejection is surfaced as a transient notice on the engine", () => {
  const event = { type: "run.finished", at: at(0), payload: { status: "rejected", reason: "capacity", engine: "claude" } };
  const rejected = rejectionOf(event);
  assert.deepEqual(rejected && rejected.engine, "claude");
  assert.equal(rejectionOf({ type: "run.finished", payload: { status: "succeeded", engine: "claude" } }), null);
  const out = deriveEngineStates(new Map(), { now: T0 + 1000, engines: ENGINES, rejections: { claude: T0 } });
  assert.equal(out.claude.status, "idle");
  assert.match(out.claude.currentTask, /rejeitada/);
  const later = deriveEngineStates(new Map(), { now: T0 + 60000, engines: ENGINES, rejections: { claude: T0 } });
  assert.equal(later.claude.currentTask, "");
});

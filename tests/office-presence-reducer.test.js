// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEvent,
  deriveEngineStates,
  EXTERNAL_PROCESSING_STALE_MS,
  sessionsFromProjection
} from "../ui/public/js/office/office-projection-reducer.js";

const ENGINES = ["claude", "gemini", "opencode", "codex"];
const T0 = Date.parse("2026-10-24T10:00:00.000Z");
const at = (offsetMs) => new Date(T0 + offsetMs).toISOString();
const ev = (type, sessionId, offset, payload = {}, extra = {}) => ({ type, sessionId, at: at(offset), payload, ...extra });
const derive = (sessions, offset = 1000) => deriveEngineStates(sessions, { now: T0 + offset, engines: ENGINES });
const external = (engine, activity, presence = "connected") => ({ origin: "external", engine, activity, presence, signal: "mtime" });

test("presence: external processing counts as working, connected-idle counts as open only", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "claude:ext-1", 0, external("claude", "processing"), { nativeSessionId: "ext-1" }));
  applyEvent(sessions, ev("session.discovered", "claude:ext-2", 0, external("claude", "idle")));
  const out = derive(sessions);
  assert.deepEqual([out.claude.status, out.claude.activeCount, out.claude.openCount], ["streaming", 1, 1]);
  assert.match(out.claude.currentTask, /externa/);
  assert.deepEqual([out.codex.activeCount, out.codex.openCount, out.codex.status], [0, 0, "idle"]);
});

test("presence: session.updated flips processing to idle and back (latest occurrence wins)", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "gemini:g1", 0, external("gemini", "processing")));
  applyEvent(sessions, ev("session.updated", "gemini:g1", 40000, external("gemini", "idle")));
  let out = derive(sessions, 50000);
  assert.deepEqual([out.gemini.activeCount, out.gemini.openCount], [0, 1]);
  applyEvent(sessions, ev("session.updated", "gemini:g1", 10000, external("gemini", "processing"))); // late, older
  out = derive(sessions, 50000);
  assert.deepEqual([out.gemini.activeCount, out.gemini.openCount], [0, 1]);
  applyEvent(sessions, ev("session.updated", "gemini:g1", 60000, external("gemini", "processing")));
  assert.equal(derive(sessions, 61000).gemini.activeCount, 1);
});

test("presence: no_recent_signal and unknown are neither working nor open", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "c:old", 0, external("claude", "unknown", "no_recent_signal")));
  const out = derive(sessions);
  assert.deepEqual([out.claude.activeCount, out.claude.openCount, out.claude.status], [0, 0, "idle"]);
});

test("presence: a Harness run and the external view of the same native session count once", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "native-9", 0, { provider: "claude" }));
  applyEvent(sessions, ev("execution.started", "native-9", 1, { engine: "claude" }, { executionId: "run-1" }));
  applyEvent(sessions, ev("session.discovered", "claude:native-9", 2, external("claude", "processing"), { nativeSessionId: "native-9" }));
  let out = derive(sessions);
  assert.equal(out.claude.activeCount, 1);
  // A different external session still adds up.
  applyEvent(sessions, ev("session.discovered", "claude:other", 3, external("claude", "processing")));
  out = derive(sessions);
  assert.equal(out.claude.activeCount, 2);
  assert.equal(out.claude.currentTask, "2 execuções ativas");
});

test("presence: same session id used for run and external signal is one working session", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("execution.started", "native-3", 0, { engine: "claude" }, { executionId: "r" }));
  applyEvent(sessions, ev("session.updated", "native-3", 1, external("claude", "processing")));
  assert.equal(derive(sessions).claude.activeCount, 1);
});

test("presence: a chat session.updated with only a native id keeps activity untouched", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "x", 0, external("claude", "processing")));
  applyEvent(sessions, ev("session.updated", "x", 5, {}, { nativeSessionId: "n" }));
  assert.equal(sessions.get("x").activity, "processing");
  assert.equal(sessions.get("x").nativeId, "n");
});

test("presence: stale external processing (no events for 5 min) stops counting as work", () => {
  const sessions = new Map();
  applyEvent(sessions, ev("session.discovered", "c:p", 0, external("claude", "processing")));
  assert.equal(derive(sessions, EXTERNAL_PROCESSING_STALE_MS - 1).claude.activeCount, 1);
  assert.equal(derive(sessions, EXTERNAL_PROCESSING_STALE_MS + 1).claude.activeCount, 0);
});

test("presence: initial projection folds origin/activity/presence; older servers degrade to not working", () => {
  const sessions = sessionsFromProjection({
    sessions: [
      { sessionId: "e1", provider: "codex", origin: "external", activity: "processing", presence: "connected", lastActivityAt: at(0), lastEventAt: at(0) },
      { sessionId: "e2", provider: "codex", origin: "external", activity: "idle", presence: "connected", lastEventAt: at(0) },
      { sessionId: "old", provider: "claude", lastEventAt: at(0) }, // no new fields at all
      { sessionId: "weird", provider: "claude", origin: "external", activity: "banana", presence: 7, lastEventAt: at(0) }
    ]
  });
  const out = derive(sessions);
  assert.deepEqual([out.codex.activeCount, out.codex.openCount, out.codex.status], [1, 1, "streaming"]);
  assert.deepEqual([out.claude.activeCount, out.claude.openCount, out.claude.status], [0, 0, "idle"]);
});

test("presence: an external session with a missing provider or null view never crashes the derivation", () => {
  const sessions = sessionsFromProjection({ sessions: [{ sessionId: "n", origin: "external", activity: "processing" }, null, {}] });
  assert.equal(derive(sessions).claude.activeCount, 0);
});

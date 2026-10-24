// @ts-check
// T2.3: ponta a ponta servidor -> projeção -> estado por motor do Escritório, com HARNESS_ROOT temporário.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-office-proj-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "projeto-office";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const require = createRequire(import.meta.url);
const { createChatRunTracker, recordCapacityRejected } = require("../ui/server/services/chat-run-telemetry.service");
const { projectSessions } = require("../ui/server/services/events/event-projector");
const { readEvents, closeStore } = require("../ui/server/services/events/event-store");

const { applyEvent, deriveEngineStates, rejectionOf, sessionsFromProjection } =
  await import("../ui/public/js/office/office-projection-reducer.js");

const ENGINES = ["claude", "gemini", "opencode"];

test.after(() => {
  closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const derive = (sessions) => deriveEngineStates(sessions, { now: Date.now(), engines: ENGINES });
const tracker = (engine, runId, extra = {}) => createChatRunTracker({ slug: SLUG, engine, runId, ...extra });

test("two simultaneous Claude runs, one finishes: projection and live stream agree (count 2 -> 1 -> 0)", () => {
  const a = tracker("claude", "run-aaaa");
  const b = tracker("claude", "run-bbbb");
  a.start();
  b.start();
  const live = new Map();
  for (const event of readEvents(SLUG, { cursor: "0", limit: 500 }).events) applyEvent(live, event);

  assert.equal(derive(sessionsFromProjection(projectSessions(SLUG))).claude.activeCount, 2);
  assert.equal(derive(live).claude.activeCount, 2);

  const before = readEvents(SLUG, { cursor: "0", limit: 500 });
  a.finish("succeeded");
  const tail = readEvents(SLUG, { cursor: before.cursor, limit: 500 });
  for (const event of tail.events) applyEvent(live, event);

  for (const sessions of [sessionsFromProjection(projectSessions(SLUG)), live]) {
    const claude = derive(sessions).claude;
    assert.deepEqual([claude.status, claude.activeCount], ["streaming", 1]);
  }

  b.onClose(false); // chat tab closed: connection drops -> cancelled
  assert.deepEqual(
    [derive(sessionsFromProjection(projectSessions(SLUG))).claude.status, derive(sessionsFromProjection(projectSessions(SLUG))).claude.activeCount],
    ["idle", 0]
  );
});

test("compare mode: Claude and Gemini runs sharing one traceId show up per engine", () => {
  const traceId = "cmp-test-1";
  tracker("claude", "run-cmp-c", { traceId }).start();
  const g = tracker("gemini", "run-cmp-g", { traceId });
  g.start();
  let out = derive(sessionsFromProjection(projectSessions(SLUG)));
  assert.equal(out.claude.activeCount, 1);
  assert.equal(out.gemini.activeCount, 1);
  g.finish("failed", { errorCode: "x" });
  out = derive(sessionsFromProjection(projectSessions(SLUG)));
  assert.deepEqual([out.claude.status, out.claude.activeCount], ["streaming", 1]);
  assert.equal(out.gemini.status, "error");
  const events = readEvents(SLUG, { cursor: "0", limit: 500 }).events.filter((e) => e.traceId === traceId);
  assert.ok(events.length >= 6);
});

test("429 rejection: run.finished(rejected) reaches the stream and is not a running execution", () => {
  recordCapacityRejected({ slug: SLUG, engine: "claude", running: 3, limit: 3, runId: "run-rej-1" });
  const rejected = readEvents(SLUG, { cursor: "0", limit: 500 }).events.map(rejectionOf).filter(Boolean);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]?.engine, "claude");
  const before = derive(sessionsFromProjection(projectSessions(SLUG))).claude.activeCount;
  assert.equal(before, 1); // only run-cmp-c from the previous test is still running
});

test("projection sessions expose provider + executionStatus (the fields the office reads)", () => {
  const running = projectSessions(SLUG).sessions.filter((s) => s.executionStatus === "running" && s.provider === "claude");
  assert.equal(running.length, 1);
});

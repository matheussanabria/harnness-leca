// @ts-check
// Proof of the phantom-session cause (story T2.5): usage.observed carries a sessionId, so the
// projector used to create a provider-less, origin-less session view for every transcript.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-usage-proj-"));
process.env.HARNESS_ROOT = ROOT;

const { appendEvent, readEvents, closeStore } = require("../ui/server/services/events/event-store");
const { projectSessions } = require("../ui/server/services/events/event-projector");

const SLUG = "tmp-usage-proj";
test.before(() => fs.mkdirSync(path.join(ROOT, "projects", SLUG), { recursive: true }));
test.after(() => {
  closeStore(SLUG);
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 60 });
});

const usage = (n) => ({
  type: "usage.observed", sessionId: `claude:native-${n}`, nativeSessionId: `native-${n}`,
  idempotencyKey: `usage|claude|call-${n}`, trust: "inferred",
  payload: { callId: `call-${n}`, provider: "anthropic", model: "m", tokens: { input: 1 }, engine: "claude" },
});

test("usage.observed does not create session views and stays queryable", () => {
  for (let i = 0; i < 3; i += 1) appendEvent(SLUG, usage(i));
  assert.equal(readEvents(SLUG, {}).events.length, 3, "usage events are kept in the log");
  assert.deepEqual(projectSessions(SLUG).sessions, [], "no phantom session views");
});

test("usage.observed does not change a real session, which keeps provider and origin", () => {
  appendEvent(SLUG, {
    type: "session.discovered", sessionId: "claude:real", nativeSessionId: "real", idempotencyKey: "d|real",
    payload: { origin: "external", provider: "claude", activity: "idle", presence: "connected", lastActivityAt: "2026-10-24T10:00:00.000Z" },
  });
  appendEvent(SLUG, { ...usage(9), sessionId: "claude:real", nativeSessionId: "real" });
  const sessions = projectSessions(SLUG).sessions;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, "claude:real");
  assert.equal(sessions[0].origin, "external");
  assert.equal(sessions[0].provider, "claude");
});

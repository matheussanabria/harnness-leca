// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-chat-tools-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-tools";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const telemetry = require("../ui/server/services/chat-run-telemetry.service");
const ingest = require("../ui/server/services/events/event-ingest");
const { readEvents, closeStore } = require("../ui/server/services/events/event-store");

test.after(() => {
  closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const stored = () => readEvents(SLUG, { limit: 1000 }).events;
const ofRun = (runId) => stored().filter((e) => e.runId === runId);
const eventOf = (runId, type) => ofRun(runId).find((e) => e.type === type);

test("Skill result publishes one skill.loaded with allow-listed metadata", () => {
  const tracker = telemetry.createChatRunTracker({ slug: SLUG, engine: "claude", runId: "run-skill" });
  tracker.start();
  tracker.toolUse({ id: "tu-1", name: "Skill", messageId: "msg-1", skillName: "alpha:beta", subagentType: null, model: null, runInBackground: null });
  tracker.toolResult({ toolUseId: "tu-1", resultOk: true });
  tracker.finish("succeeded");

  const event = eventOf("run-skill", "skill.loaded");
  assert.deepEqual(event.payload, {
    skillName: "alpha:beta",
    toolUseId: "tu-1",
    callId: "msg-1",
    resultOk: true,
    evidence: "tool_use",
  });
  assert.equal(event.idempotencyKey, "tool|run-skill|tu-1");
  assert.equal(ofRun("run-skill").filter((e) => e.type === "skill.loaded").length, 1);
});

test("Agent and Task results publish tool.invoked; duplicate toolUse is a single event", () => {
  const tracker = telemetry.createChatRunTracker({ slug: SLUG, engine: "claude", runId: "run-agent" });
  tracker.start();
  const agent = { id: "tu-2", name: "Agent", messageId: "msg-2", skillName: null, subagentType: "architect", model: "sonnet", runInBackground: false };
  tracker.toolUse(agent);
  tracker.toolUse(agent);
  tracker.toolResult({ toolUseId: "tu-2", resultOk: null });
  tracker.toolUse({ id: "tu-3", name: "Task", messageId: null, skillName: null, subagentType: "dev", model: null, runInBackground: null });
  tracker.toolResult({ toolUseId: "tu-3", resultOk: false });
  tracker.finish("succeeded");

  const invoked = ofRun("run-agent").filter((e) => e.type === "tool.invoked");
  assert.equal(invoked.length, 2);
  assert.deepEqual(invoked[0].payload, {
    toolName: "Agent",
    subagentType: "architect",
    model: "sonnet",
    runInBackground: false,
    toolUseId: "tu-2",
    callId: "msg-2",
    resultOk: null,
  });
  assert.deepEqual(invoked[1].payload, {
    toolName: "Task",
    subagentType: "dev",
    model: null,
    runInBackground: null,
    toolUseId: "tu-3",
    callId: null,
    resultOk: false,
  });
  assert.equal(invoked[0].idempotencyKey, "tool|run-agent|tu-2");
  assert.equal(invoked[1].idempotencyKey, "tool|run-agent|tu-3");
});

test("cancel flushes pending tools with resultOk null before the terminal events", () => {
  const tracker = telemetry.createChatRunTracker({ slug: SLUG, engine: "claude", runId: "run-cancel" });
  tracker.start();
  tracker.toolUse({ id: "tu-4", name: "Skill", messageId: "msg-4", skillName: "pending", subagentType: null, model: null, runInBackground: null });
  tracker.finish("cancelled", { reason: "client_disconnected" });

  const events = ofRun("run-cancel");
  const skill = events.find((e) => e.type === "skill.loaded");
  assert.equal(skill.payload.resultOk, null);
  assert.ok(events.findIndex((e) => e.type === "skill.loaded") < events.findIndex((e) => e.type === "execution.cancelled"));
  assert.deepEqual(events.map((e) => e.type).slice(-2), ["execution.cancelled", "run.finished"]);
  assert.equal(events.filter((e) => e.type === "skill.loaded").length, 1);
});

test("publish failure never throws and pending state still clears", () => {
  const original = ingest.ingestEvent;
  const warn = console.warn;
  console.warn = () => {};
  ingest.ingestEvent = () => { throw new Error("store offline"); };
  try {
    const tracker = telemetry.createChatRunTracker({ slug: SLUG, engine: "claude", runId: "run-fail" });
    assert.doesNotThrow(() => {
      tracker.start();
      tracker.toolUse({ id: "tu-5", name: "Agent", messageId: "msg-5", subagentType: "dev", model: null, runInBackground: null });
      tracker.toolResult({ toolUseId: "tu-5", resultOk: true });
      tracker.finish("failed", { errorCode: "unknown" });
      tracker.toolResult({ toolUseId: "tu-5", resultOk: true });
    });
  } finally {
    ingest.ingestEvent = original;
    console.warn = warn;
  }
});

// @ts-check
// Experiment Q3: replay the SAME synthetic Claude transcript lines through both pipelines and check
// that the join key for T4.1e is identical: the live stream parser + chat run tracker (skill.loaded /
// tool.invoked) and the transcript usage ingest (usage.observed) must both use message.id as callId.
//
// LIMIT: this proves only that both code paths read the same field (message.id) of the same line.
// It does NOT prove that the real Claude CLI emits the same message.id in its live stream-json as it
// writes to the transcript; that needs one captured real stream. Everything here is synthetic and
// no real transcript or home directory is read.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-callid-replay-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const SLUG = "projeto-replay";
fs.mkdirSync(path.join(TMP_ROOT, "projects", SLUG), { recursive: true });

const telemetry = require("../ui/server/services/chat-run-telemetry.service");
const store = require("../ui/server/services/events/event-store");
const { createClaudeStreamParser } = require("../tools/lib/engines/claude");
const { createUsageIngestor } = require("../ui/server/services/usage-ingest/usage-ingestor");
const fx = require("./usage-ingest-fixtures");

const NOW = Date.parse("2026-10-24T12:00:00.000Z");
const SENTINEL_DESC = "SENTINEL_DESC_q3";
const SENTINEL_PROMPT = "SENTINEL_PROMPT_q3";
const CALL_ID = "msg_replay_001";

const skillLine = {
  parentUuid: "p", isSidechain: false, type: "assistant", uuid: "u-replay-1",
  sessionId: "sess-replay", timestamp: "2026-10-20T10:00:00.000Z", requestId: "req-replay",
  cwd: "C:\\work\\demo-proj",
  message: {
    id: CALL_ID, model: "claude-sonnet-5-5", role: "assistant",
    content: [{ type: "tool_use", id: "toolu_replay_skill", name: "Skill", input: { skill: "demo-skill" } }],
    usage: { input_tokens: 3, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 },
  },
};

const agentLine = {
  parentUuid: "p", isSidechain: false, type: "assistant", uuid: "u-replay-2",
  sessionId: "sess-replay", timestamp: "2026-10-20T10:00:01.000Z", requestId: "req-replay",
  cwd: "C:\\work\\demo-proj",
  message: {
    id: CALL_ID, model: "claude-sonnet-5-5", role: "assistant",
    content: [{
      type: "tool_use", id: "toolu_replay_agent", name: "Agent",
      input: { subagent_type: "demo-agent", description: SENTINEL_DESC, prompt: SENTINEL_PROMPT },
    }],
    usage: { input_tokens: 3, output_tokens: 25, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 },
  },
};

const resultLine = {
  type: "user", isSidechain: false, sessionId: "sess-replay", timestamp: "2026-10-20T10:00:02.000Z",
  message: {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_replay_skill", content: "ok" },
      { type: "tool_result", tool_use_id: "toolu_replay_agent", content: "ok" },
    ],
  },
  toolUseResult: { success: true },
};

const LINES = [skillLine, agentLine, resultLine].map((line) => JSON.stringify(line));

test.after(() => {
  store.closeStore(SLUG);
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

test("stream and transcript pipelines derive the same callId from the same lines", async (t) => {
  // Pipeline A: same raw lines as stream-json events, parsed by the real parser and tracked.
  const tracker = telemetry.createChatRunTracker({ slug: SLUG, engine: "claude", runId: "run-replay" });
  const sink = tracker.wrapSink({ onChunk() {}, onDone() {}, onError() {}, onToolUse() {}, onToolResult() {} });
  tracker.start();
  const parser = createClaudeStreamParser(sink, null);
  for (const raw of LINES) parser.line(raw);
  tracker.finish("succeeded");

  const streamEvents = store.readEvents(SLUG, { limit: 1000 }).events.filter((e) => e.runId === "run-replay");
  const skill = streamEvents.find((e) => e.type === "skill.loaded");
  const agent = streamEvents.find((e) => e.type === "tool.invoked");

  // Pipeline B: the same lines as one temp transcript file, read by the real ingest tick.
  const root = path.join(TMP_ROOT, "claude-transcripts");
  const file = path.join(root, "C--work-demo-proj", "sess-replay.jsonl");
  fx.writeLines(file, LINES, { mtimeMs: NOW - 3600 * 1000 });
  const ingestor = createUsageIngestor({
    root, now: () => NOW, host: "h", estimator: null,
    resolveProject: (hint) => (hint.includes("demo-proj") ? SLUG : null),
  });
  ingestor.tick();
  const usage = store.readEvents(SLUG, { types: ["usage.observed"], limit: 1000 }).events;

  await t.test("stream: Skill and Agent events share one callId", () => {
    assert.ok(skill, "skill.loaded was published");
    assert.ok(agent, "tool.invoked was published");
    assert.equal(skill.payload.callId, CALL_ID);
    assert.equal(agent.payload.callId, CALL_ID);
    assert.equal(skill.payload.resultOk, null, "two-result line: the top-level success flag is ambiguous and must not be reused");
    assert.equal(agent.payload.resultOk, null, "two-result line: the top-level success flag is ambiguous and must not be reused");
    assert.equal(streamEvents.filter((e) => e.type === "skill.loaded").length, 1);
  });

  await t.test("transcript: streaming duplicates collapse into one usage.observed", () => {
    assert.equal(usage.length, 1);
    assert.equal(usage[0].payload.callId, CALL_ID);
    assert.equal(usage[0].payload.tokens.output, 25);
    assert.equal(usage[0].payload.tokens.input, 3);
    assert.equal(usage[0].payload.tokens.cacheRead, 100);
    assert.equal(usage[0].payload.tokens.cacheCreation, 7);
  });

  await t.test("join on payload.callId is the same id in both pipelines", () => {
    assert.equal(usage[0].payload.callId, skill.payload.callId);
    assert.equal(usage[0].payload.callId, agent.payload.callId);
    const groups = new Map();
    for (const event of store.readEvents(SLUG, { limit: 1000 }).events) {
      if (event.type !== "skill.loaded" && event.type !== "usage.observed") continue;
      const key = event.payload.callId;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(event.type);
    }
    assert.equal(groups.size, 1);
    assert.equal([...groups.keys()][0], CALL_ID);
    assert.deepEqual([...groups.get(CALL_ID)].sort(), ["skill.loaded", "usage.observed"]);
  });

  await t.test("sentinels never reach any event or the store bytes", () => {
    const eventsBlob = JSON.stringify(store.readEvents(SLUG, { limit: 1000 }).events);
    for (const sentinel of [SENTINEL_DESC, SENTINEL_PROMPT]) {
      assert.ok(!eventsBlob.includes(sentinel), `${sentinel} leaked into events`);
    }
    store.closeStore(SLUG);
    const dir = path.join(TMP_ROOT, "projects", SLUG, "coordination");
    for (const name of fs.readdirSync(dir)) {
      const bytes = fs.readFileSync(path.join(dir, name)).toString("latin1");
      for (const sentinel of [SENTINEL_DESC, SENTINEL_PROMPT]) {
        assert.ok(!bytes.includes(sentinel), `${sentinel} leaked into ${name}`);
      }
    }
  });
});

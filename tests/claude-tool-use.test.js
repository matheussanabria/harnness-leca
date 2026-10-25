// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractToolUse, extractToolResult } = require("../tools/lib/engines/claude-tool-use");
const { createClaudeStreamParser } = require("../tools/lib/engines/claude");

const SENTINELS = [
  "SENTINEL-PROMPT",
  "SENTINEL-DESC",
  "SENTINEL-OUTPUT",
  "SENTINEL-TOP",
  "SENTINEL-AGENT",
  "SENTINEL-TASK",
  "SENTINEL-BASH",
];

test("extractToolUse: Skill keeps only allow-listed metadata", () => {
  const info = extractToolUse({
    type: "tool_use",
    id: "tu-skill",
    name: "Skill",
    input: { skill: "alpha:beta", prompt: "SENTINEL-PROMPT", description: "SENTINEL-DESC", model: "claude-sonnet-4", run_in_background: true },
  }, "msg-1");
  assert.deepEqual(info, {
    id: "tu-skill",
    name: "Skill",
    messageId: "msg-1",
    skillName: "alpha:beta",
    subagentType: null,
    model: "claude-sonnet-4",
    runInBackground: true,
  });
  assert.ok(!JSON.stringify(info).includes("SENTINEL"));
});

test("extractToolUse: Agent and Task alias expose subagentType and no skillName", () => {
  const agent = extractToolUse({
    type: "tool_use",
    id: "tu-agent",
    name: "Agent",
    input: { subagent_type: "architect", description: "SENTINEL-AGENT", prompt: "SENTINEL-PROMPT", model: "sonnet", run_in_background: false },
  }, "msg-2");
  assert.equal(agent.name, "Agent");
  assert.equal(agent.subagentType, "architect");
  assert.equal(agent.skillName, null);
  assert.equal(agent.runInBackground, false);

  const task = extractToolUse({ type: "tool_use", id: "tu-task", name: "Task", input: { subagent_type: "dev", prompt: "SENTINEL-TASK" } }, null);
  assert.equal(task.name, "Task");
  assert.equal(task.subagentType, "dev");
  assert.equal(task.messageId, null);
});

test("extractToolUse: unknown tools, invalid metadata and missing ids are rejected or nulled", () => {
  assert.equal(extractToolUse({ type: "tool_use", id: "x", name: "Read", input: {} }, "m"), null);
  assert.equal(extractToolUse({ type: "text", id: "x", name: "Skill", input: {} }, "m"), null);
  const bad = extractToolUse({
    type: "tool_use",
    name: "Skill",
    input: { skill: "bad skill!", model: "bad model!", run_in_background: "yes" },
  }, 42);
  assert.equal(bad.id, null);
  assert.equal(bad.skillName, null);
  assert.equal(bad.model, null);
  assert.equal(bad.runInBackground, null);
  assert.equal(bad.messageId, null);
  const long = extractToolUse({ type: "tool_use", id: "y", name: "Agent", input: { subagent_type: "x".repeat(61) } }, "m");
  assert.equal(long.subagentType, null);
});

test("extractToolResult: is_error wins, absence is null, top-level success is a fallback", () => {
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "a", is_error: false }, null), { toolUseId: "a", resultOk: true });
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "b", is_error: true }, { success: true }), { toolUseId: "b", resultOk: false });
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "c" }, null), { toolUseId: "c", resultOk: null });
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "d" }, { success: true }), { toolUseId: "d", resultOk: true });
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "e" }, { success: false }), { toolUseId: "e", resultOk: false });
  assert.deepEqual(extractToolResult({ type: "tool_result", tool_use_id: "f", is_error: false }, { success: false }), { toolUseId: "f", resultOk: true });
  assert.equal(extractToolResult({ type: "text", text: "x" }, null), null);
});

test("parser: line-level toolUseResult only applies to lines with a single tool_result", () => {
  const run = (events) => {
    const results = [];
    const parser = createClaudeStreamParser({ onToolResult: (info) => results.push(info) }, null);
    feed(parser, events);
    return results;
  };
  const single = (success) => run([{
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "tu-1" }] },
    toolUseResult: { success },
  }]);

  assert.deepEqual(single(true), [{ toolUseId: "tu-1", resultOk: true }]);
  assert.deepEqual(single(false), [{ toolUseId: "tu-1", resultOk: false }]);

  const parallel = run([{
    type: "user",
    message: { content: [
      { type: "tool_result", tool_use_id: "tu-ok", is_error: false },
      { type: "tool_result", tool_use_id: "tu-err", is_error: true },
    ] },
    toolUseResult: { success: true },
  }]);
  assert.deepEqual(parallel, [
    { toolUseId: "tu-ok", resultOk: true },
    { toolUseId: "tu-err", resultOk: false },
  ], "each block's own is_error wins and the line-level flag is ignored");
});

function feed(parser, events) {
  for (const event of events) parser.line(JSON.stringify(event));
}

function streamEvents() {
  return [
    { type: "system", session_id: "sess-1" },
    { type: "assistant", message: { id: "msg-1", content: [{ type: "text", text: "Alpha" }, { type: "thinking", thinking: "plan" }] } },
    { type: "assistant", message: { id: "msg-1", content: [
      { type: "text", text: "Alpha" },
      { type: "tool_use", id: "tu-skill", name: "Skill", input: { skill: "alpha:beta", prompt: "SENTINEL-PROMPT", description: "SENTINEL-DESC" } },
    ] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "tu-skill", content: "SENTINEL-OUTPUT", is_error: false }] }, toolUseResult: { success: true, content: "SENTINEL-TOP" } },
    { type: "assistant", message: { id: "msg-2", content: [
      { type: "tool_use", id: "tu-agent", name: "Agent", input: { subagent_type: "architect", description: "SENTINEL-AGENT", prompt: "SENTINEL-PROMPT" } },
    ] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "tu-agent" }] } },
    { type: "assistant", message: { content: [
      { type: "tool_use", id: "tu-task", name: "Task", input: { subagent_type: "dev", prompt: "SENTINEL-TASK" } },
      { type: "tool_use", id: "tu-bash", name: "Bash", input: { command: "SENTINEL-BASH" } },
    ] } },
    { type: "assistant", message: { id: "msg-3", content: [{ type: "text", text: "Omega" }] } },
    { type: "result", result: "Omega" },
  ];
}

test("parser callbacks emit Skill/Agent/Task metadata, dedup by block id and ignore unknown tools", () => {
  const toolUses = [];
  const toolResults = [];
  const parser = createClaudeStreamParser({
    onChunk: () => {},
    onToolUse: (info) => toolUses.push(info),
    onToolResult: (info) => toolResults.push(info),
  }, null);
  feed(parser, streamEvents());

  assert.equal(toolUses.length, 3, "the repeated Skill message is deduplicated by block id");
  assert.deepEqual(toolUses.map((i) => [i.name, i.id, i.skillName, i.subagentType, i.messageId]), [
    ["Skill", "tu-skill", "alpha:beta", null, "msg-1"],
    ["Agent", "tu-agent", null, "architect", "msg-2"],
    ["Task", "tu-task", null, "dev", null],
  ]);
  assert.deepEqual(toolResults, [
    { toolUseId: "tu-skill", resultOk: true },
    { toolUseId: "tu-agent", resultOk: null },
  ]);
  assert.equal(parser.text, "Alpha\n\nOmega");
  const dump = JSON.stringify({ toolUses, toolResults });
  for (const sentinel of SENTINELS) assert.ok(!dump.includes(sentinel), `${sentinel} leaked into callbacks`);
});

test("parser SSE chunks are identical with and without tool callbacks", () => {
  const run = (options) => {
    const chunks = [];
    const parser = typeof options === "function"
      ? createClaudeStreamParser((c) => chunks.push(c), null)
      : createClaudeStreamParser({ ...options, onChunk: (c) => chunks.push(c) }, null);
    feed(parser, streamEvents());
    return { chunks, text: parser.text, sessionId: parser.sessionId, errored: parser.errored };
  };
  const withoutCallbacks = run(() => {});
  const withCallbacks = run({ onToolUse: () => {}, onToolResult: () => {} });
  assert.deepEqual(withCallbacks.chunks, withoutCallbacks.chunks);
  assert.equal(withCallbacks.text, withoutCallbacks.text);
  assert.equal(withCallbacks.sessionId, withoutCallbacks.sessionId);
  assert.equal(withCallbacks.errored, withoutCallbacks.errored);
  assert.equal(withoutCallbacks.text, "Alpha\n\nOmega");
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { checkAnswer } = require("../tools/lib/hia/quality-gate");

// Real outputs from kr/MiniMax-M2.5 through 9Router (2026-10-31 combo tests).
const KIRO_XML = "\n\n<tool_code>\n<tool name=\"Glob\">\n<tool_arg>pattern>**/*.test.ts</tool_arg>\n</tool>\n</tool_code>\n";
const KIRO_BRACKETS = "Let me first check the project structure.\n[TOOL_CALL]\n{tool => \"glob\", args => {\n  --pattern \"**/*MathUtil*\"\n}}\n[/TOOL_CALL]";

test("quality-gate - accepts a normal answer", () => {
  assert.deepEqual(checkAnswer({ text: "A git worktree lets you check out several branches at once.", finish: "stop" }), { ok: true, code: "ok", reason: "" });
});

test("quality-gate - flags empty and whitespace-only answers", () => {
  assert.equal(checkAnswer({ text: "" }).code, "empty");
  assert.equal(checkAnswer({ text: "  \n\t " }).code, "empty");
  assert.equal(checkAnswer({}).code, "empty");
});

test("quality-gate - flags fake tool-call answers in both observed formats", () => {
  assert.equal(checkAnswer({ text: KIRO_XML }).code, "fake_tool_call");
  assert.equal(checkAnswer({ text: KIRO_BRACKETS }).code, "fake_tool_call");
});

test("quality-gate - keeps answers that mention tool markup inside real content", () => {
  const doc = `${"Tool calls let the model ask the host to run a function. ".repeat(6)}\nExample:\n[TOOL_CALL]\n{tool => "glob"}\n[/TOOL_CALL]`;
  assert.equal(checkAnswer({ text: doc, finish: "stop" }).ok, true);
});

test("quality-gate - flags answers cut off at the token limit", () => {
  const r = checkAnswer({ text: "export function Button(props: Pr", finish: "length" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "truncated");
});

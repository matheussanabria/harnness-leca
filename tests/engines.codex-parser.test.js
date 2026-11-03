// Testes sem dependências: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseLine } = require("../tools/lib/engines/codex");

const run = (lines) => {
  const state = { sessionId: "", text: "", error: "" };
  const chunks = [];
  lines.forEach((l) => parseLine(JSON.stringify(l), (c) => chunks.push(c), state));
  return { state, chunks };
};

test("codex: thread.started (CLI recente) define o sessionId", () => {
  const { state, chunks } = run([
    { type: "thread.started", thread_id: "01a19eba-02c7-79e2-a567-1d54a074962b" },
    { type: "item.completed", item: { type: "agent_message", text: "ok" } },
  ]);
  assert.equal(state.sessionId, "01a19eba-02c7-79e2-a567-1d54a074962b");
  assert.equal(chunks[0].sessionId, state.sessionId);
});

test("codex: session_meta (formato antigo) continua valendo", () => {
  const { state } = run([{ type: "session_meta", payload: { session_id: "abc" } }]);
  assert.equal(state.sessionId, "abc");
});

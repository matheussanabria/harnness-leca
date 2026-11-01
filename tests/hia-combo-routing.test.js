// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

// The dispatcher writes telemetry to disk; here the write is replaced and the records are captured.
const records = [];
const telemetryPath = require.resolve("../tools/lib/hia/telemetry");
require.cache[telemetryPath] = {
  id: telemetryPath, filename: telemetryPath, loaded: true,
  exports: { recordExecution: (r) => records.push(r), getTelemetryMetrics: () => ({}) },
};

const { resolveComboModel, rememberCombo, resetComboMemory } = require("../tools/lib/hia/combo-routing");
const { handleChatWithHia } = require("../ui/server/services/hia-chat-dispatcher.service");

const ON = { HIA_COMBO_ROUTING: "true" };
const BUGS = { combo: "harness-bugs", modelRef: "9router/harness-bugs" };
const GENERAL = { combo: "harness-implementacao", modelRef: "9router/harness-implementacao" };

test("combo-routing - off by default and off for other engines", () => {
  resetComboMemory();
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", suggestion: BUGS, env: {} }), "");
  assert.equal(resolveComboModel({ engine: "claude", model: "9router/harness-implementacao", suggestion: BUGS, env: ON }), "");
});

test("combo-routing - only replaces the 'route for me' model, never a model the user picked", () => {
  resetComboMemory();
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", suggestion: BUGS, env: ON }), "9router/harness-bugs");
  assert.equal(resolveComboModel({ engine: "opencode", model: "glm-5.3-flash-free", suggestion: BUGS, env: ON }), "");
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-review", suggestion: BUGS, env: ON }), "");
});

test("combo-routing - the general suggestion keeps the picked model", () => {
  resetComboMemory();
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", suggestion: GENERAL, env: ON }), "");
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", env: ON }), "");
});

test("combo-routing - a conversation keeps its combo on follow-up turns", () => {
  resetComboMemory();
  rememberCombo("ses_abc", "9router/harness-testes");
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", sessionId: "ses_abc", suggestion: BUGS, env: ON }), "9router/harness-testes");
  assert.equal(resolveComboModel({ engine: "opencode", model: "glm-5.3-flash-free", sessionId: "ses_abc", env: ON }), "", "an explicit model change wins");
  assert.equal(resolveComboModel({ engine: "opencode", model: "9router/harness-implementacao", sessionId: "ses_other", env: ON }), "");
});

test("combo-routing - HIA_COMBO_ROUTING_FROM widens the trigger models", () => {
  resetComboMemory();
  const env = { ...ON, HIA_COMBO_ROUTING_FROM: "9router/harness-implementacao, glm-5.3-flash-free" };
  assert.equal(resolveComboModel({ engine: "opencode", model: "glm-5.3-flash-free", suggestion: BUGS, env }), "9router/harness-bugs");
});

/** Runs the dispatcher on the cloud route and returns what the engine fallback received. */
async function dispatch(extra) {
  const calls = [];
  const chunks = [];
  await handleChatWithHia({
    engine: "opencode", model: "9router/harness-implementacao", slug: "harness-leca",
    prompt: "investigue a causa raiz desta exception no log",
    sink: { onChunk: (d) => chunks.push(d), onDone: () => {}, onError: (e) => { throw e; } },
    fallbackStream: (override) => calls.push(override),
    ...extra,
  });
  return { calls, chunks };
}

test("combo-routing dispatcher - flag off: the picked model runs and the suggestion is only recorded", async () => {
  resetComboMemory(); records.length = 0;
  delete process.env.HIA_COMBO_ROUTING;
  const { calls } = await dispatch();
  assert.deepEqual(calls, [undefined]);
  assert.equal(records[0].suggestedCombo, "harness-bugs");
  assert.equal(records[0].appliedCombo, undefined);
});

test("combo-routing dispatcher - flag on: runs on the combo, tells the user and remembers it by session", async (t) => {
  resetComboMemory(); records.length = 0;
  process.env.HIA_COMBO_ROUTING = "true";
  t.after(() => { delete process.env.HIA_COMBO_ROUTING; });

  const first = await dispatch();
  assert.equal(first.calls[0].model, "9router/harness-bugs");
  assert.equal(records[0].appliedCombo, "9router/harness-bugs");
  assert.ok(first.chunks.some((c) => /Roteado para o combo harness-bugs/.test(c.text)));

  // The engine finishes the turn and returns its session id; the follow-up turn (with history) keeps the combo.
  first.calls[0].onDone({ sessionId: "ses_xyz" });
  const follow = await dispatch({ sessionId: "ses_xyz", history: [{ role: "user", text: "oi" }], prompt: "e agora, ajuste o teste" });
  assert.equal(follow.calls[0].model, "9router/harness-bugs");
});

test("combo-routing dispatcher - the combo is remembered from the first chunk, even if the turn never finishes", async (t) => {
  resetComboMemory(); records.length = 0;
  process.env.HIA_COMBO_ROUTING = "true";
  t.after(() => { delete process.env.HIA_COMBO_ROUTING; });

  const first = await dispatch();
  // The client drops mid-stream: only a chunk carrying the session id arrives, onDone is never called.
  first.calls[0].onChunk({ type: "text", text: "..." }); // no session id yet: nothing remembered
  assert.equal((await dispatch({ sessionId: "ses_drop" })).calls[0].model, "9router/harness-bugs", "a fresh classification, nothing stored yet");
  first.calls[0].onChunk({ type: "text", text: "...", sessionId: "ses_drop" });
  const follow = await dispatch({ sessionId: "ses_drop", history: [{ role: "user", text: "oi" }], prompt: "agora implemente a tela de login" });
  assert.equal(follow.calls[0].model, "9router/harness-bugs", "the follow-up keeps the combo chosen on the first turn");
});

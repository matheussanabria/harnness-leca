// Normalizer copies the cache_creation TTL split; absent stays null, numeric 0 stays 0.
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractCall, mergeCall } = require("../ui/server/services/usage-ingest/call-normalizer");
const fx = require("./usage-ingest-fixtures");

const tokensOf = (usage, extra = {}) => {
  const r = extractCall(fx.assistantLine({ id: "m1", usage, ...extra }));
  assert.equal(r.status, "call");
  return r.call;
};

test("split copied, total unchanged", () => {
  const c = tokensOf({ cache_creation_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 4, ephemeral_1h_input_tokens: 6 } });
  assert.equal(c.tokens.cacheCreation, 10);
  assert.equal(c.tokens.cacheCreation5m, 4);
  assert.equal(c.tokens.cacheCreation1h, 6);
});

test("absent split is null; numeric zero stays zero; garbage is null", () => {
  const none = tokensOf({ cache_creation_input_tokens: 10 });
  assert.equal(none.tokens.cacheCreation5m, null);
  assert.equal(none.tokens.cacheCreation1h, null);
  const zero = tokensOf({ cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: "x" } });
  assert.equal(zero.tokens.cacheCreation5m, 0);
  assert.equal(zero.tokens.cacheCreation1h, null);
  assert.equal(tokensOf({ cache_creation: "oops" }).tokens.cacheCreation5m, null);
});

test("streaming merge keeps the final (maximum) split", () => {
  const a = tokensOf({ cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 2 } });
  const b = tokensOf({ cache_creation: { ephemeral_5m_input_tokens: 3, ephemeral_1h_input_tokens: 5 } });
  const m = mergeCall(a, b);
  assert.equal(m.tokens.cacheCreation5m, 3);
  assert.equal(m.tokens.cacheCreation1h, 5);
  assert.equal(mergeCall(tokensOf({}), tokensOf({})).tokens.cacheCreation1h, null);
});

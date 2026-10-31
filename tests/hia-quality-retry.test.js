// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { withQualityRetry, pickRetryModel, isFreeRetryModel } = require("../tools/lib/hia/quality-retry");

const GOOD = "A git worktree lets you check out several branches at once in separate folders.";
const FAKE = "<tool_code>\n<tool name=\"Glob\">\n<tool_arg>pattern>**/*.ts</tool_arg>\n</tool>\n</tool_code>";

/** Builds the deps with call recording. */
function harness(first, second, env = {}) {
  const calls = { retryModels: /** @type {string[]} */ ([]), notices: /** @type {string[]} */ ([]) };
  return {
    calls,
    run: (model = "9router/Harness") => withQualityRetry({
      model,
      env,
      attempt: async () => first,
      retry: async (m) => { calls.retryModels.push(m); return second; },
      notice: (t) => calls.notices.push(t),
    }),
  };
}

test("quality-retry - a good answer is returned as is, without retry or notice", async () => {
  const h = harness({ text: GOOD, finish: "stop", sessionId: "ses_a" }, null);
  const r = await h.run();
  assert.equal(r.text, GOOD);
  assert.equal(r.replaced, false);
  assert.deepEqual(h.calls.retryModels, []);
  assert.deepEqual(h.calls.notices, []);
});

test("quality-retry - an empty answer is retried once with a free model and replaced", async () => {
  const h = harness({ text: "", sessionId: "ses_a" }, { text: GOOD, finish: "stop", sessionId: "ses_b" });
  const r = await h.run("9router/harness-testes");
  assert.deepEqual(h.calls.retryModels, ["opencode/deepseek-v4.1-flash-free"]);
  assert.equal(r.replaced, true);
  assert.equal(r.text, GOOD);
  assert.equal(r.sessionId, "ses_b");
  assert.equal(r.gate.ok, true);
  assert.equal(h.calls.notices.length, 1);
});

test("quality-retry - a fake tool-call answer is retried; a second failure is reported, never escalated", async () => {
  const h = harness({ text: FAKE }, { text: "" });
  const r = await h.run();
  assert.equal(h.calls.retryModels.length, 1);
  assert.equal(r.gate.code, "empty");
  assert.equal(h.calls.notices.length, 2);
  assert.match(h.calls.notices[1], /never used automatically/);
});

test("quality-retry - truncated answers are flagged but not retried", async () => {
  const h = harness({ text: "export function Bu", finish: "length" }, null);
  const r = await h.run();
  assert.equal(r.gate.code, "truncated");
  assert.equal(r.replaced, false);
  assert.deepEqual(h.calls.retryModels, []);
});

test("quality-retry - HIA_QUALITY_RETRY=false only flags", async () => {
  const h = harness({ text: "" }, null, { HIA_QUALITY_RETRY: "false" });
  const r = await h.run();
  assert.equal(r.replaced, false);
  assert.deepEqual(h.calls.retryModels, []);
  assert.equal(h.calls.notices.length, 1);
});

test("quality-retry - an aborted first attempt is returned untouched", async () => {
  const h = harness({ text: "", aborted: true }, null);
  const r = await h.run();
  assert.equal(r.aborted, true);
  assert.deepEqual(h.calls.retryModels, []);
});

test("quality-retry - the retry model is free and different from the failed one", () => {
  assert.equal(pickRetryModel("9router/harness-bugs", {}), "opencode/deepseek-v4.1-flash-free");
  assert.equal(pickRetryModel("opencode/deepseek-v4.1-flash-free", {}), "9router/Harness");
  assert.equal(pickRetryModel("x", { HIA_RETRY_MODEL: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free" }), "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free");
  assert.equal(pickRetryModel("x", { HIA_RETRY_MODEL: "cc/claude-sonnet-5-5" }), "", "a paid retry model is refused");
  assert.equal(isFreeRetryModel("9router/harness-review"), false, "combos with premium tails are not retry models");
});

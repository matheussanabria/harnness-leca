// @ts-check
// Routing outcomes: combo success/failure and fallbacks recorded by the dispatcher, and the read-only aggregation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// The dispatcher writes telemetry to disk; here the write is replaced and the records are captured.
const records = [];
const telemetryPath = require.resolve("../tools/lib/hia/telemetry");
require.cache[telemetryPath] = {
  id: telemetryPath, filename: telemetryPath, loaded: true,
  exports: { recordExecution: (r) => records.push(r), getTelemetryMetrics: () => ({}) },
};

const { handleChatWithHia } = require("../ui/server/services/hia-chat-dispatcher.service");
const { resetComboMemory } = require("../tools/lib/hia/combo-routing");
const { readRoutingOutcomes } = require("../ui/server/services/usage-ingest/routing-outcomes-reader");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");

const SENTINEL = "SENTINEL-ERROR-MESSAGE-XYZ";

async function dispatchCombo(extra = {}) {
  const calls = [];
  await handleChatWithHia({
    engine: "opencode", model: "9router/harness-implementacao", slug: "demo",
    prompt: "investigue a causa raiz desta exception no log",
    sink: { onChunk() {}, onDone() {}, onError() {} },
    fallbackStream: (override) => calls.push(override),
    ...extra,
  });
  return calls[0];
}

const outcomes = () => records.filter((r) => r.executorType === "combo");

test("combo turn: success and failure are recorded once, without error text", async (t) => {
  resetComboMemory(); records.length = 0;
  process.env.HIA_COMBO_ROUTING = "true";
  t.after(() => { delete process.env.HIA_COMBO_ROUTING; });
  const ok = await dispatchCombo();
  ok.onDone({ sessionId: "ses_1" });
  ok.onDone({ sessionId: "ses_1" });
  const bad = await dispatchCombo();
  bad.onError(Object.assign(new Error(SENTINEL), { code: "ETIMEDOUT" }));
  assert.deepEqual(outcomes().map((r) => r.status), ["succeeded", "failed"]);
  assert.equal(outcomes()[1].error, "ETIMEDOUT");
  assert.equal(outcomes()[1].appliedCombo, "9router/harness-bugs");
  assert.ok(!JSON.stringify(records).includes(SENTINEL));
});

test("combo turn: a cancelled turn is not recorded as a failure", async (t) => {
  resetComboMemory(); records.length = 0;
  process.env.HIA_COMBO_ROUTING = "true";
  t.after(() => { delete process.env.HIA_COMBO_ROUTING; });
  const ac = new AbortController();
  const call = await dispatchCombo({ signal: ac.signal });
  ac.abort();
  call.onError(new Error("aborted"));
  assert.equal(outcomes().length, 0);
});

test("reader: aggregates combos and fallbacks, ignores bad lines, never exposes prompts", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rt-")), "hia-executions.jsonl");
  const rec = (o) => JSON.stringify({ recordedAt: "2026-11-02T10:00:00.000Z", promptPreview: SENTINEL, ...o });
  fs.writeFileSync(file, [
    rec({ executorType: "combo", appliedCombo: "9router/harness-bugs", status: "succeeded" }),
    rec({ executorType: "combo", appliedCombo: "9router/harness-bugs", status: "failed", error: "ETIMEDOUT" }),
    rec({ executorType: "script", status: "fallback" }),
    rec({ executorType: "local_llm", status: "fallback" }),
    rec({ executorType: "local_llm", status: "fallback" }),
    rec({ executorType: "cloud", status: "routed", appliedCombo: "9router/x" }),
    "not json",
  ].join("\n") + "\n");
  const out = readRoutingOutcomes({ file });
  assert.deepEqual(out.combos.map((c) => [c.combo, c.ok, c.failed, c.lastError]), [["harness-bugs", 1, 1, "ETIMEDOUT"]]);
  assert.deepEqual(out.fallbacks, { script: 1, local_llm: 2 });
  assert.ok(!JSON.stringify(out).includes(SENTINEL));
});

test("reader: missing log degrades to empty with a warning; route is registered", () => {
  const out = readRoutingOutcomes({ file: path.join(os.tmpdir(), "nope-routing.jsonl") });
  assert.deepEqual(out.combos, []);
  assert.equal(out.warnings.length, 1);
  assert.ok(centralEventRoutes.some((r) => r.method === "GET" && r.path.test("/api/usage/routing")));
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateSnapshot } = require("../ui/server/services/usage-ingest/quota-model");
const { createQuotaStore } = require("../ui/server/services/usage-ingest/quota-store");
const { extractQuota } = require("../ui/server/services/usage-ingest/codex-quota-normalizer");
const { buildQuotas } = require("../ui/server/services/usage-ingest/quota-merge");
const { loadPlanConfig } = require("../ui/server/services/usage-ingest/quota-plans-config");

const NOW = Date.parse("2026-11-01T12:00:00Z");
const line = (rl, ts = "2026-11-01T11:50:00Z") =>
  JSON.stringify({ timestamp: ts, type: "event_msg", payload: { type: "token_count", rate_limits: rl } });

test("validateSnapshot descarta campos extras e provedor invalido", () => {
  const s = validateSnapshot({ provider: "codex", window: "weekly", observedAt: "2026-11-01T10:00:00Z", used: 12, apiKey: "x" });
  assert.equal(s.provider, "codex");
  assert.equal("apiKey" in s, false);
  assert.equal(validateSnapshot({ provider: "x", window: "weekly", observedAt: "2026-11-01T10:00:00Z" }), null);
});

test("extractQuota converte janelas e resets_at", () => {
  const w = extractQuota(line({ plan_type: "plus", primary: { used_percent: 40, window_minutes: 10080, resets_at: 1793534400 } }));
  assert.equal(w.window, "weekly");
  assert.equal(w.used, 40);
  assert.equal(w.unit, "percent");
  assert.equal(w.resetsAt, new Date(1793534400 * 1000).toISOString());
  assert.equal(extractQuota(line({ primary: { used_percent: 5, window_minutes: 300 } })).window, "5h");
  assert.equal(extractQuota(line({ primary: { used_percent: 5 } })), null);
  assert.equal(extractQuota("nao e json"), null);
});

test("store guarda o mais recente e ignora o mais antigo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quota-"));
  const store = createQuotaStore({ dir });
  const base = { provider: "codex", window: "weekly", unit: "percent" };
  assert.equal(store.save({ ...base, used: 10, observedAt: "2026-11-01T10:00:00Z" }), true);
  assert.equal(store.save({ ...base, used: 5, observedAt: "2026-11-01T09:00:00Z" }), false);
  assert.equal(store.list()[0].used, 10);
  assert.equal(createQuotaStore({ dir }).list()[0].used, 10);
});

test("buildQuotas marca stale e trata janela expirada como desconhecida", () => {
  const stored = [
    { provider: "codex", window: "weekly", observedAt: "2026-11-01T11:50:00Z", resetsAt: "2026-11-02T00:00:00Z", used: 40, unit: "percent" },
    { provider: "codex", window: "5h", observedAt: "2026-11-01T11:50:00Z", resetsAt: "2026-11-01T11:00:00Z", used: 90, unit: "percent" },
  ].map(validateSnapshot);
  const out = buildQuotas({ stored, config: loadPlanConfig("/nao/existe.json"), nowMs: NOW });
  const weekly = out.quotas.find((q) => q.window === "weekly");
  const five = out.quotas.find((q) => q.window === "5h");
  assert.equal(weekly.stale, false);
  assert.equal(five.used, null);
  assert.equal(five.confidence, "unknown");
  assert.equal(five.stale, true);
  assert.deepEqual(out.plans.map((p) => p.plan), ["Pro", "Plus", "Pro"]);
});

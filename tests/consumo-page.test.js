// @ts-check
// Consumo page: pure model (gauges, null handling, sorting) and escaped, emoji-free views.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const mod = (f) => import(pathToFileURL(path.resolve("ui", "public", "js", "consumo", f)).href);
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

const snap = (over = {}) => ({ provider: "codex", plan: "Plus", window: "weekly", used: 50, limit: 200, unit: "percent",
  resetsAt: null, observedAt: "2026-11-02T10:00:00.000Z", source: "rollout", confidence: "observed", stale: false, ...over });

test("quota cards: percent, level, estimated and stale badges, window order", async () => {
  const { buildQuotaCards, quotaPercent, gaugeLevel } = await mod("consumo-model.js");
  assert.equal(quotaPercent(snap()), 25);
  assert.equal(quotaPercent(snap({ used: null })), null);
  assert.equal(quotaPercent(snap({ limit: 0 })), null);
  assert.equal(gaugeLevel(95), "high");
  assert.equal(gaugeLevel(null), "unknown");
  const cards = buildQuotaCards({
    plans: [{ provider: "claude", plan: "Pro" }, { provider: "codex", plan: "Plus" }],
    quotas: [snap(), snap({ window: "5h", stale: true }), snap({ provider: "claude", plan: "Pro", used: null, limit: 45, confidence: "manual" })],
  });
  assert.deepEqual(cards.map((c) => c.provider), ["claude", "codex"]);
  assert.deepEqual(cards[1].windows.map((w) => w.window), ["5h", "weekly"]);
  assert.equal(cards[1].windows[0].stale, true);
  assert.equal(cards[0].windows[0].estimated, true);
  assert.equal(cards[0].windows[0].pct, null);
  assert.equal(cards[0].windows[0].usedText, "n/d");
});

test("combo rows sort by tokens and keep failures as a real number", async () => {
  const { buildComboRows, buildOpenCodeRows } = await mod("consumo-model.js");
  const rows = buildComboRows([
    { combo: "a", provider: "p", model: "m1", calls: 1, tokensIn: 10, tokensOut: 5, failures: 0, lastAt: "" },
    { combo: "", provider: "p", model: "m2", calls: 9, tokensIn: 1000, tokensOut: 500, failures: 2, lastAt: "" },
  ]);
  assert.equal(rows[0].model, "m2");
  assert.equal(rows[0].combo, "n/d");
  assert.equal(rows[0].outcome.text, "n/d");
  const merged = buildComboRows([{ combo: "a", provider: "p", model: "a", calls: 1, tokensIn: 1 }], [{ combo: "a", ok: 4, failed: 1, lastError: "ETIMEDOUT" }]);
  assert.equal(merged[0].outcome.text, "4 / 1");
  assert.equal(merged[0].outcome.failed, true);
  assert.ok(merged[0].outcome.title.includes("ETIMEDOUT"));
  assert.equal(rows[0].tokensIn.text, "1,0 K");
  const oc = buildOpenCodeRows([{ provider: "9router", model: "x", viaRouter: true, calls: 1, tokensIn: 9e9 }, { provider: "o", model: "y", calls: 1, tokensIn: 1 }]);
  assert.equal(oc[0].viaRouter, false);
});

test("views escape values, show badges and contain no emoji", async () => {
  const { renderQuotas, renderCombos, renderAsOf } = await mod("consumo-view.js");
  const { buildQuotaCards, buildComboRows } = await mod("consumo-model.js");
  const html = renderQuotas(buildQuotaCards({ plans: [{ provider: "claude", plan: "<b>Pro</b>" }],
    quotas: [snap({ provider: "claude", confidence: "manual", stale: true })] }));
  assert.ok(!html.includes("<b>Pro</b>"));
  assert.ok(html.includes("estimado") && html.includes("desatualizado"));
  const combos = renderCombos(buildComboRows([{ combo: "<img>", provider: "p", model: "m", calls: 1 }]));
  assert.ok(!combos.includes("<img>"));
  const asOf = renderAsOf([{ id: "q", label: "Cotas", ok: false, error: "Servidor indisponível.", atText: "n/d", warnings: [] }]);
  assert.ok(asOf.includes("indisponível"));
  for (const out of [html, combos, asOf]) assert.ok(!EMOJI.test(out));
});

test("api: one failing source does not break the others", async () => {
  const { loadConsumo } = await mod("consumo-api.js");
  const fetchImpl = async (url) => (url.includes("combos")
    ? { ok: false, status: 500, json: async () => ({}) }
    : { ok: true, json: async () => ({ generatedAt: "2026-11-02T10:00:00.000Z" }) });
  const r = await loadConsumo({ fetchImpl });
  assert.equal(r.combos.ok, false);
  assert.equal(r.quotas.ok, true);
  assert.equal(r.trend.ok, false);
  assert.equal(r.gemini.ok, true);
  const { buildGeminiRows } = await mod("consumo-model.js");
  const { renderGemini } = await mod("consumo-view.js");
  const html = renderGemini(buildGeminiRows([{ day: "2026-08-04", sessions: 2, prompts: 7, responses: 20, errors: 0 }]), true);
  assert.ok(html.includes("2026-08-04") && html.includes("parcial") && !EMOJI.test(html));
});

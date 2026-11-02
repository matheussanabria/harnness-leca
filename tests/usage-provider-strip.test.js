// @ts-check
// Office provider strip: gauge rendering, escaping, no emoji, failure notice and teardown.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const mod = () => import(pathToFileURL(path.resolve("ui", "public", "js", "modules", "usage-provider-strip.js")).href);
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
const snap = (over = {}) => ({ provider: "codex", plan: "Plus", window: "weekly", used: 50, limit: 100, unit: "percent",
  resetsAt: null, observedAt: "2026-11-02T10:00:00.000Z", confidence: "observed", stale: false, ...over });

test("strip renders gauges with estimated and stale flags, n/d for unknown, escaped, no emoji", async () => {
  const { renderProviderStrip } = await mod();
  const { buildQuotaCards } = await import(pathToFileURL(path.resolve("ui", "public", "js", "consumo", "consumo-model.js")).href);
  const html = renderProviderStrip(buildQuotaCards({
    plans: [{ provider: "claude", plan: "<i>Pro</i>" }],
    quotas: [snap(), snap({ provider: "claude", window: "5h", used: null, confidence: "manual", stale: true })],
  }));
  assert.ok(html.includes("50%") && html.includes("n/d"));
  assert.ok(html.includes('aria-label="estimado"') && html.includes('aria-label="desatualizado"'));
  assert.ok(!html.includes("<i>Pro</i>"));
  assert.ok(html.includes('href="/consumo"') && !EMOJI.test(html));
  assert.equal(renderProviderStrip([]), "");
});

test("mount: paints on success, shows a notice on failure, destroy stops painting", async () => {
  const { mountProviderStrip } = await mod();
  const root = { innerHTML: "" };
  const ok = mountProviderStrip(root, { doc: { hidden: false }, pollMs: 1e9,
    fetchImpl: async () => ({ ok: true, json: async () => ({ plans: [{ provider: "claude", plan: "Pro" }], quotas: [] }) }) });
  await ok.first;
  assert.ok(root.innerHTML.includes("ups-card"));
  ok.destroy();

  const bad = { innerHTML: "" };
  const failing = mountProviderStrip(bad, { doc: { hidden: false }, pollMs: 1e9, fetchImpl: async () => ({ ok: false, status: 500 }) });
  await failing.first;
  assert.ok(bad.innerHTML.includes("indisponíveis"));
  failing.destroy();

  const gone = { innerHTML: "" };
  const late = mountProviderStrip(gone, { doc: { hidden: false }, pollMs: 1e9, fetchImpl: async () => ({ ok: true, json: async () => ({ plans: [{ provider: "x", plan: "p" }], quotas: [] }) }) });
  late.destroy();
  await late.first;
  assert.equal(gone.innerHTML, "");
});

test("tab wiring: strip root precedes the panel root and is torn down with the tab", async () => {
  const tab = await import(pathToFileURL(path.resolve("ui", "public", "js", "office3d", "orchestration", "tab-usage.js")).href);
  const html = tab.renderUsageTab("demo");
  assert.ok(html.indexOf('id="usageStripRoot"') < html.indexOf('id="usagePanelRoot"'));
  assert.doesNotThrow(() => tab.unmountUsageTab());
});

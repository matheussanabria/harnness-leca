// @ts-check
// Aba Consumo: formatadores e view-model (null nunca vira 0, divisão principal vs subagentes).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const mod = (f) => import(pathToFileURL(path.resolve("ui", "public", "js", "modules", f)).href);
const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

const tok = (o = {}) => ({ input: null, output: null, cacheRead: null, cacheCreation: null, reasoning: null, ...o });
const cost = (amount) => ({ amount, currency: "USD", kind: "estimated", basis: "api-equivalent" });

function fixture(over = {}) {
  return {
    project: "p", since: null, groupBy: "day",
    totals: {
      calls: 10, tokens: tok({ input: 100, output: 2500, cacheRead: 1500000, cacheCreation: 4000 }), cost: cost(1.5),
      byOrigin: {
        main: { calls: 6, tokens: tok({ input: 60, output: 1000 }), cost: cost(0.5) },
        subagent: { calls: 4, tokens: tok({ input: 40, output: 1500 }), cost: cost(1) },
      },
    },
    groups: [
      { key: "2026-10-20", calls: 2, tokens: tok({ output: 10 }), cost: cost(0.1) },
      { key: "2026-10-22", calls: 8, tokens: tok({ output: 2490 }), cost: cost(null) },
    ],
    coverage: { calls: 10, callsWithUsage: 10, callsWithCost: 8, callsWithoutModelPrice: 2, sidechainCalls: 4, linesUnparsable: 3, unpricedModels: [{ model: "x-new", calls: 2 }] },
    pricing: { version: "v1", reviewStatus: "pending-user-review", basis: "api-equivalent", retrievedAt: "2026-10-24" },
    ingest: { enabled: true },
    ...over,
  };
}

test("formatCompact: K/M/B com valor exato e null como n/d", async () => {
  const f = await mod("usage-format.js");
  assert.equal(f.formatCompact(null), "n/d");
  assert.equal(f.formatCompact(undefined), "n/d");
  assert.equal(f.formatCompact(0), "0");
  assert.equal(f.formatCompact(999), "999");
  assert.equal(f.formatCompact(2500), "2,5 K");
  assert.equal(f.formatCompact(1500000), "1,5 M");
  assert.equal(f.formatCompact(3200000000), "3,2 B");
  assert.equal(f.formatExact(null), "n/d");
  assert.equal(f.formatExact(1500000), (1500000).toLocaleString("pt-BR"));
});

test("formatCost: null e amount null viram n/d, nunca US$ 0", async () => {
  const f = await mod("usage-format.js");
  assert.equal(f.formatCost(null), "n/d");
  assert.equal(f.formatCost(cost(null)), "n/d");
  assert.equal(f.formatCost(cost(0)), "US$ 0,0000");
  assert.equal(f.formatCost(cost(1.5)), "US$ 1,50");
});

test("sharePercent e sumKnown: indeterminável é null", async () => {
  const f = await mod("usage-format.js");
  assert.equal(f.sharePercent(4, 10), 40);
  assert.equal(f.sharePercent(null, 10), null);
  assert.equal(f.sharePercent(1, 0), null);
  assert.equal(f.sumKnown([null, undefined]), null);
  assert.equal(f.sumKnown([null, 2, 3]), 5);
  assert.equal(f.formatPercent(null), "n/d");
});

test("view-model: cartões, reasoning n/d e custo estimado", async () => {
  const vm = (await mod("usage-view-model.js")).buildUsageViewModel({ day: fixture(), model: { groups: [] }, session: { groups: [] } });
  assert.equal(vm.status, "ready");
  assert.deepEqual(vm.cards.map((c) => c.id), ["calls", "output", "cacheRead", "cacheCreation", "input", "cost"]);
  const byId = Object.fromEntries(vm.cards.map((c) => [c.id, c]));
  assert.equal(byId.output.text, "2,5 K");
  assert.equal(byId.cacheRead.text, "1,5 M");
  assert.equal(byId.cost.text, "US$ 1,50");
  assert.equal(vm.reasoningText, "n/d");
  assert.equal(vm.notices.pendingReview, true);
  assert.equal(vm.coverage.text, "8 de 10 chamadas com custo");
  assert.deepEqual(vm.coverage.unpriced, [{ model: "x-new", calls: 2 }]);
});

test("view-model: valores null nos totais renderizam n/d em todos os cartões", async () => {
  const day = fixture({ totals: { calls: 3, tokens: tok(), cost: null } });
  const vm = (await mod("usage-view-model.js")).buildUsageViewModel({ day });
  for (const c of vm.cards.filter((x) => x.id !== "calls")) assert.equal(c.text, "n/d", c.id);
  assert.equal(vm.origin, null);
});

test("divisão principal vs subagentes: parcelas corretas e null não vira 0", async () => {
  const { buildOriginSplit } = await mod("usage-view-model.js");
  const [main, sub] = buildOriginSplit(fixture().totals.byOrigin);
  assert.equal(sub.share.calls, 40);
  assert.equal(main.share.calls, 60);
  assert.equal(sub.share.tokens, 59.2);
  assert.equal(sub.share.cost, 66.7);
  assert.equal(main.share.cost, 33.3);
  const partial = buildOriginSplit({ main: { calls: 5, tokens: tok(), cost: null }, subagent: { calls: 5, tokens: tok(), cost: cost(2) } });
  assert.equal(partial[1].share.cost, null);
  assert.equal(partial[1].cost, 2);
  assert.equal(partial[0].cost, null);
  assert.equal(partial[1].share.tokens, null);
  assert.equal(buildOriginSplit(undefined), null);
  assert.equal(buildOriginSplit({ main: { calls: 1 } }), null);
});

test("bucketDays: preenche dias sem chamadas e escala as barras", async () => {
  const { bucketDays } = await mod("usage-view-model.js");
  const days = bucketDays(fixture().groups);
  assert.deepEqual(days.map((d) => d.key), ["2026-10-20", "2026-10-21", "2026-10-22"]);
  assert.equal(days[1].calls, 0);
  assert.equal(days[1].heightPct, 0);
  assert.equal(days[2].heightPct, 100);
  assert.equal(days[2].costText, "n/d");
  assert.match(days[0].text, /20\/10: 2 chamadas/);
  assert.deepEqual(bucketDays(null), []);
});

test("sessões: ordenadas por custo (null por último), id curto, motor e modelos", async () => {
  const { buildUsageViewModel } = await mod("usage-view-model.js");
  const session = { groups: [
    { key: "aaaaaaaa-1111", calls: 9, tokens: tok(), cost: cost(null), engine: "codex", model: "m1" },
    { key: "bbbbbbbb-2222", calls: 2, tokens: tok(), cost: cost(3), engine: "claude", models: ["m2", "m3"], lastAt: "2026-10-22T10:00:00Z" },
  ] };
  const vm = buildUsageViewModel({ day: fixture(), session });
  assert.deepEqual(vm.sessions.map((s) => s.shortId), ["bbbbbbbb", "aaaaaaaa"]);
  assert.equal(vm.sessions[0].modelsText, "m2, m3");
  assert.equal(vm.sessions[1].costText, "n/d");
  assert.equal(vm.sessions[1].lastAtText, "n/d");
});

test("estados: vazio, desativado e pronto; campos aditivos ausentes degradam", async () => {
  const { buildUsageViewModel } = await mod("usage-view-model.js");
  const empty = fixture({ totals: { calls: 0, tokens: tok(), cost: cost(null) }, groups: [] });
  assert.equal(buildUsageViewModel({ day: empty }).status, "empty");
  assert.equal(buildUsageViewModel({ day: { ...empty, ingest: { enabled: false } } }).status, "disabled");
  assert.equal(buildUsageViewModel({ day: fixture({ ingest: { enabled: false } }) }).status, "ready");
  const legacy = fixture();
  delete legacy.pricing; delete legacy.totals.byOrigin; delete legacy.coverage.unpricedModels;
  const vm = buildUsageViewModel({ day: legacy });
  assert.equal(vm.notices.pendingReview, false);
  assert.equal(vm.origin, null);
  assert.deepEqual(vm.coverage.unpriced, []);
});

test("view: avisos, escape e ausência de emojis", async () => {
  const { buildUsageViewModel } = await mod("usage-view-model.js");
  const { renderUsagePanel } = await mod("usage-render.js");
  const session = { groups: [{ key: "<b>x</b>", calls: 1, tokens: tok(), cost: cost(1), engine: "claude" }] };
  const html = renderUsagePanel({ status: "ready", window: "7d", vm: buildUsageViewModel({ day: fixture(), model: { groups: [] }, session }) });
  assert.match(html, /ESTIMADO/);
  assert.match(html, /equivalente em API/);
  assert.match(html, /pending-user-review/);
  assert.match(html, /8 de 10 chamadas com custo/);
  assert.match(html, /x-new/);
  assert.match(html, /Subagentes/);
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(!EMOJI.test(html));
  assert.match(html, /aria-pressed="true"/);
});

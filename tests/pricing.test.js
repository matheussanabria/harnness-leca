const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { estimateCost, normalizeModelId, PRICE_TABLE_VERSION } = require("../tools/lib/pricing");
const { validateTable, loadTable, DEFAULT_FILE } = require("../tools/lib/pricing/loader");
const cli = require("../tools/pricing");

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
const M = 1e6;

test("anthropic arithmetic with all four token kinds", () => {
  const r = estimateCost({
    provider: "anthropic", model: "claude-sonnet-5-5",
    tokens: { input: M, output: M, cacheRead: M, cacheCreation: M }, at: "2026-10-24",
  });
  close(r.amount, 2 + 10 + 0.1 + 2.5);
  assert.equal(r.currency, "USD");
  assert.equal(r.kind, "estimated");
  assert.equal(r.basis, "api-equivalent");
  assert.equal(r.priceTableVersion, PRICE_TABLE_VERSION);
  assert.deepEqual(r.missing, []);
});

test("haiku 5.5 switches to the higher tier above 100k prompt tokens", () => {
  const low = estimateCost({ provider: "claude", model: "claude-haiku-5-5", tokens: { input: 50000, output: 10000 } });
  close(low.amount, 0.005 + 0.005);
  const high = estimateCost({ provider: "claude", model: "claude-haiku-5-5", tokens: { input: 150000, output: 10000 } });
  close(high.amount, 0.075 + 0.025);
  const viaCache = estimateCost({ provider: "claude", model: "claude-haiku-5-5", tokens: { input: 10000, cacheRead: 100000 } });
  close(viaCache.amount, (10000 * 0.5 + 100000 * 0.05) / M);
});

test("openai subtracts cached from input and never double counts reasoning", () => {
  const r = estimateCost({
    provider: "codex", model: "gpt-5.4",
    tokens: { input: 200000, cacheRead: 80000, output: 100000, reasoning: 50000 },
  });
  close(r.amount, 0.3 + 0.02 + 1.5);
});

test("openai cache creation has no published rate and is listed as missing", () => {
  const r = estimateCost({ provider: "openai", model: "gpt-5", tokens: { input: 200000, cacheCreation: 5000 } });
  close(r.amount, 0.25);
  assert.deepEqual(r.missing, ["cacheCreation"]);
  assert.equal(estimateCost({ provider: "openai", model: "gpt-5", tokens: { cacheCreation: 5000 } }), null);
});

test("openai prompts above the captured 272k range return null", () => {
  assert.equal(estimateCost({ provider: "openai", model: "gpt-5.4", tokens: { input: 300000, output: 1 } }), null);
});

test("gemini adds reasoning to output and uses the long-context tier", () => {
  const r = estimateCost({
    provider: "gemini", model: "gemini-2.5-pro",
    tokens: { input: 100000, cacheRead: 20000, output: 10000, reasoning: 5000 },
  });
  close(r.amount, 0.1 + 0.0025 + 0.15);
  const big = estimateCost({ provider: "gemini", model: "gemini-2.5-pro", tokens: { input: 300000 } });
  close(big.amount, 0.75);
});

test("date dependent rates follow the at timestamp", () => {
  const now = estimateCost({ provider: "gemini", model: "gemini-3.8-flash", tokens: { input: M }, at: "2026-10-24" });
  const later = estimateCost({ provider: "gemini", model: "gemini-3.8-flash", tokens: { input: M }, at: "2027-02-01" });
  close(now.amount, 0.75);
  close(later.amount, 1.5);
});

test("null counts are skipped, never turned into zero", () => {
  const r = estimateCost({ provider: "anthropic", model: "claude-opus-5-5", tokens: { input: M, output: null } });
  close(r.amount, 4);
  assert.equal(estimateCost({ provider: "anthropic", model: "claude-opus-5-5", tokens: { input: null, output: null } }), null);
  assert.equal(estimateCost({ provider: "anthropic", model: "claude-opus-5-5", tokens: {} }), null);
  assert.equal(estimateCost({ provider: "anthropic", model: "claude-opus-5-5" }), null);
});

test("unknown provider or model stays unknown", () => {
  assert.equal(estimateCost({ provider: "anthropic", model: "sonnet", tokens: { input: 1 } }), null);
  assert.equal(estimateCost({ provider: "anthropic", model: "<synthetic>", tokens: { input: 1 } }), null);
  assert.equal(estimateCost({ provider: "nobody", model: "claude-opus-5-5", tokens: { input: 1 } }), null);
  assert.equal(estimateCost({ provider: "openai", model: "claude-opus-5-5", tokens: { input: 1 } }), null);
});

test("model id normalisation strips context, latest and date suffixes", () => {
  assert.deepEqual(normalizeModelId("Claude-Sonnet-5-5[1m]"), ["claude-sonnet-5-5"]);
  assert.deepEqual(normalizeModelId("claude-haiku-4-5-20251001"), ["claude-haiku-4-5-20251001", "claude-haiku-4-5"]);
  const t = { input: M };
  const base = estimateCost({ provider: "anthropic", model: "claude-haiku-4-5", tokens: t }).amount;
  for (const id of ["claude-haiku-4-5-20251001", "claude-haiku-4-5-latest", "claude-haiku-4-5[1m]"]) {
    close(estimateCost({ provider: "anthropic", model: id, tokens: t }).amount, base);
  }
});

test("schema validation rejects a table without sourceUrl", () => {
  const table = JSON.parse(fs.readFileSync(DEFAULT_FILE, "utf8"));
  assert.deepEqual(validateTable(table), []);
  delete table.models[0].sourceUrl;
  assert.ok(validateTable(table).some((e) => /sourceUrl/.test(e)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-"));
  const file = path.join(dir, "bad.json");
  fs.writeFileSync(file, JSON.stringify(table));
  assert.throws(() => loadTable(file), /sourceUrl/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("every published entry has sourceUrl, retrievedAt and a review flag", () => {
  const { table } = loadTable();
  assert.equal(table.reviewStatus, "pending-user-review");
  assert.ok(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(table.version));
  for (const m of table.models) {
    assert.ok(m.sourceUrl, `${m.id} sourceUrl`);
    assert.ok(m.retrievedAt, `${m.id} retrievedAt`);
  }
  for (const id of ["claude-sonnet-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]) {
    assert.ok(table.models.some((m) => m.id === id), id);
  }
});

test("cli estimate and list", () => {
  const out = [];
  cli.main(["estimate", "--model", "claude-opus-5-5", "--input", "1000000", "--json"], (s) => out.push(s));
  close(JSON.parse(out[0]).amount, 4);
  cli.main(["estimate", "--model", "mystery", "--input", "1", "--json"], (s) => out.push(s));
  assert.equal(out[1], "null");
  const lines = [];
  assert.equal(cli.main(["list"], (s) => lines.push(s)), 0);
  assert.ok(lines.length > 10);
});

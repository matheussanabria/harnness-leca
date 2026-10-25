// Cache-write TTL split in the cost estimator (additive: absent or inconsistent split keeps the old behaviour).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { estimateCost } = require("../tools/lib/pricing");
const { DEFAULT_FILE } = require("../tools/lib/pricing/loader");

const M = 1e6;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
// claude-sonnet-5-5 per million: cacheWrite5m 2.5, cacheWrite1h 4
const est = (tokens, opts) => estimateCost({ provider: "anthropic", model: "claude-sonnet-5-5", tokens, at: "2026-10-24" }, opts);

test("split billed at its own rates: 1M/1M, 400k/600k, 1h only", () => {
  close(est({ cacheCreation: 2 * M, cacheCreation5m: M, cacheCreation1h: M }).amount, 2.5 + 4);
  close(est({ cacheCreation: M, cacheCreation5m: 400000, cacheCreation1h: 600000 }).amount, 1.0 + 2.4);
  const only1h = est({ cacheCreation: M, cacheCreation5m: 0, cacheCreation1h: M });
  close(only1h.amount, 4);
  assert.deepEqual(only1h.missing, []);
});

test("split without a total is accepted and summed", () => {
  const r = est({ cacheCreation: null, cacheCreation5m: M, cacheCreation1h: M });
  close(r.amount, 6.5);
  assert.deepEqual(r.missing, []);
});

test("split mixes with the other token kinds", () => {
  const r = est({ input: M, output: M, cacheRead: M, cacheCreation: 2 * M, cacheCreation5m: M, cacheCreation1h: M });
  close(r.amount, 2 + 10 + 0.1 + 2.5 + 4);
});

test("absent split or one-sided split bills the total at the 5m rate, no flag", () => {
  for (const extra of [{}, { cacheCreation5m: null, cacheCreation1h: null }, { cacheCreation5m: M }, { cacheCreation1h: M }]) {
    const r = est({ cacheCreation: M, ...extra });
    close(r.amount, 2.5);
    assert.deepEqual(r.missing, []);
  }
});

test("inconsistent split falls back to the total at the 5m rate and is listed", () => {
  const r = est({ cacheCreation: M, cacheCreation5m: 100000, cacheCreation1h: 100000 });
  close(r.amount, 2.5);
  assert.deepEqual(r.missing, ["cacheCreationSplit"]);
});

test("only a split with nothing else prices, null-only still returns null", () => {
  assert.equal(est({ cacheCreation: null, cacheCreation5m: null, cacheCreation1h: null }), null);
  assert.ok(est({ cacheCreation5m: M, cacheCreation1h: 0 }) !== null);
});

test("model without a 1h rate: 1h part falls back to the 5m rate and is listed", () => {
  const table = JSON.parse(fs.readFileSync(DEFAULT_FILE, "utf8"));
  for (const m of table.models) if (m.id === "claude-sonnet-5-5") for (const r of m.rates) delete r.cacheWrite1h;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "price-split-"));
  const file = path.join(dir, "prices.json");
  try {
    fs.writeFileSync(file, JSON.stringify(table));
    const r = est({ cacheCreation: 2 * M, cacheCreation5m: M, cacheCreation1h: M }, { file });
    close(r.amount, 5);
    assert.deepEqual(r.missing, ["cacheWrite1h"]);
    const zero = est({ cacheCreation: M, cacheCreation5m: M, cacheCreation1h: 0 }, { file });
    assert.deepEqual(zero.missing, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

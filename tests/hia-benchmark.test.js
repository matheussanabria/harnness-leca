// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDataset, runBenchmark } = require("../tools/lib/hia/benchmark");

test("HIA Benchmark - carrega dataset versionado existente", () => {
  const ds = loadDataset("intent-classification");
  assert.equal(ds.name, "intent-classification");
  assert.ok(Array.isArray(ds.cases));
  assert.ok(ds.cases.length > 0);
});

test("HIA Benchmark - erro ao carregar dataset inexistente", () => {
  assert.throws(() => {
    loadDataset("dataset-fantasma-inexistente");
  }, /não encontrado/);
});

test("HIA Benchmark - runBenchmark gera resultado consistente", async () => {
  const res = await runBenchmark({ datasetName: "intent-classification" });
  assert.ok(res.timestamp);
  assert.equal(res.dataset, "intent-classification");
  assert.ok(typeof res.skipped === "boolean");
  assert.ok(res.hardware);
});

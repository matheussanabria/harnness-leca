const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { runRegression } = require("../scripts/regressao.js");

const steps = ["a", "b", "c"].map((label) => ({ label, args: [] }));

test("regressao: todas verdes", () => {
  const seen = [];
  const r = runRegression({ steps, runner: (l) => (seen.push(l), { ok: true, code: 0 }) });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(seen, ["a", "b", "c"]);
});

test("regressao: para na primeira falha", () => {
  const seen = [];
  const r = runRegression({ steps, runner: (l) => (seen.push(l), { ok: l !== "b", code: l === "b" ? 1 : 0 }) });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(seen, ["a", "b"]);
});

test("regressao: cadeia padrao e pre-push", () => {
  const labels = [];
  runRegression({ runner: (l) => (labels.push(l), { ok: true, code: 0 }) });
  assert.strictEqual(labels.length, 4);
  assert.match(labels[3], /types-baseline/);
  const hook = fs.readFileSync(path.join(__dirname, "..", ".githooks", "pre-push"), "utf8");
  assert.match(hook, /regressao\.js/);
});

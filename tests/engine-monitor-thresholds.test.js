// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { loadThresholds, DEFAULT_THRESHOLDS } = require("../tools/lib/engine-monitor/thresholds");

test("thresholds: carrega padrões quando arquivo não existe", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-thresh-"));
  const { thresholds, rawLoaded, warnings } = loadThresholds(tmp);
  assert.equal(rawLoaded, false);
  assert.equal(thresholds.pollIntervalMs, DEFAULT_THRESHOLDS.pollIntervalMs);
  assert.equal(warnings.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("thresholds: leitura tolerante com recuperação de valores inválidos", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-thresh-"));
  fs.mkdirSync(path.join(tmp, "global"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "global", "engine-monitor.json"),
    JSON.stringify({
      pollIntervalMs: -50,
      hibernateAfterMs: 900000,
    }),
    "utf8"
  );

  const { thresholds, rawLoaded, warnings } = loadThresholds(tmp);
  assert.equal(rawLoaded, true);
  assert.equal(thresholds.pollIntervalMs, DEFAULT_THRESHOLDS.pollIntervalMs, "cai no padrão em número negativo");
  assert.equal(thresholds.hibernateAfterMs, 900000);
  assert.ok(warnings.length > 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

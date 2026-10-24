// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Telemetria grava em <ROOT>/logs/telemetry. ROOT e lido uma vez, ao carregar root.js,
// entao a raiz temporaria precisa existir ANTES de qualquer require de tools/.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "hia-guard-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { ExecutionQueue, LoopGuard } = require("../tools/lib/hia/guard");
const { recordExecution, getTelemetryMetrics } = require("../tools/lib/hia/telemetry");

test("HIA Guard - ExecutionQueue limita concorrência a 1", async () => {
  const queue = new ExecutionQueue(1);
  let active = 0;
  let maxActiveObserved = 0;

  const runTask = async () => {
    return queue.run(async () => {
      active++;
      maxActiveObserved = Math.max(maxActiveObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    });
  };

  await Promise.all([runTask(), runTask(), runTask()]);
  assert.equal(maxActiveObserved, 1, "concorrência máxima observada deve ser 1");
  assert.equal(queue.getActiveCount(), 0);
});

test("HIA Guard - LoopGuard detecta 3 repetições consecutivas idênticas", () => {
  const guard = new LoopGuard(3);
  assert.equal(guard.check("git.status", {}).isLoop, false);
  assert.equal(guard.check("git.status", {}).isLoop, false);
  const third = guard.check("git.status", {});
  assert.equal(third.isLoop, true);
  assert.equal(third.occurrences, 3);
});

test("HIA Telemetry - grava e calcula economia de tokens", () => {
  recordExecution({
    executionId: "exec-" + Date.now(),
    executorType: "script",
    executorId: "git.status",
    status: "succeeded",
    durationMs: 45,
    tokensPrompt: 0,
    tokensCompletion: 0,
    tokensTotal: 0,
    tokensSaved: 1200,
  });

  const metrics = getTelemetryMetrics();
  assert.ok(metrics.totalExecutions > 0);
  assert.ok(metrics.totalTokensSaved >= 1200);
});

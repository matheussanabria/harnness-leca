// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MIN_SAFE_RAM_MB,
  getMemoryProfile,
  getCpuProfile,
  getHardwareSnapshot,
} = require("../tools/lib/hia/hardware-profiler");

test("HIA Hardware Profiler - getMemoryProfile", () => {
  const mem = getMemoryProfile();
  assert.ok(mem.totalMb > 0, "totalMb deve ser maior que zero");
  assert.ok(mem.freeMb >= 0, "freeMb deve ser >= zero");
  assert.ok(mem.usedMb > 0, "usedMb deve ser > zero");
  assert.ok(typeof mem.safeForInference === "boolean", "safeForInference deve ser booleano");
  assert.equal(mem.safeForInference, mem.freeMb >= MIN_SAFE_RAM_MB);
});

test("HIA Hardware Profiler - getCpuProfile", () => {
  const cpu = getCpuProfile();
  assert.ok(cpu.logicalCores > 0, "logicalCores deve ser maior que zero");
  assert.ok(typeof cpu.model === "string", "model deve ser string");
  assert.ok(cpu.recommendedThreads >= 2, "recommendedThreads deve ser no minimo 2");
  assert.ok(cpu.recommendedThreads <= 6, "recommendedThreads deve ser no maximo 6");
});

test("HIA Hardware Profiler - getHardwareSnapshot", () => {
  const snap = getHardwareSnapshot();
  assert.ok(snap.timestamp, "snapshot deve ter timestamp ISO");
  assert.ok(snap.memory, "snapshot deve ter objeto memory");
  assert.ok(snap.cpu, "snapshot deve ter objeto cpu");
  assert.equal(typeof snap.viable, "boolean");
  if (!snap.viable) {
    assert.ok(snap.alert, "deve emitir alerta quando nao viavel");
  }
});

test("HIA Router - só escolhe o motor local quando a RAM livre é segura", (t) => {
  if (process.env.HIA_ROUTING_ENABLED === "false") return t.skip("roteamento desativado no ambiente");
  const { routeTask } = require("../tools/lib/hia/router");
  const decide = () => routeTask({ prompt: "resuma em poucas palavras o texto abaixo" }).destination;
  const expected = getHardwareSnapshot().viable ? "local_llm" : "cloud";
  assert.equal(decide(), expected, "o gate de hardware do roteador acompanha a RAM livre real");
});

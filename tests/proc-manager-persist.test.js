// @ts-check
// Readoção de serviços após reinício do servidor da interface (ui:dev com --watch).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-proc-"));
process.env.HARNESS_ROOT = tmpRoot;
const { runningServices } = require("../tools/lib/proc-manager-store");
const persist = require("../tools/lib/proc-manager-persist");
const { stopService } = require("../tools/lib/proc-manager-run");

const SLUG = "projeto-teste";
const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const alive = (/** @type {number} */ pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
/** @param {number} pid */
const waitDead = async (pid) => { for (let i = 0; i < 40 && alive(pid); i++) await sleep(100); return !alive(pid); };
const entry = (/** @type {number} */ pid, /** @type {number} */ startedAt) => ({ slug: SLUG, serviceId: "api", name: "API", command: "x", cwd: tmpRoot, url: "http://localhost:59999/x", pid, startedAt });
const noListener = { findListener: () => null, startOf: () => null };

test.beforeEach(() => {
  runningServices.clear();
  persist.resetAdoptionForTests();
  fs.rmSync(path.join(tmpRoot, "temp"), { recursive: true, force: true });
});
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test("persist - recordStart grava e recordStop remove a entrada", () => {
  persist.recordStart(`${SLUG}:api`, entry(1234, Date.now()));
  assert.equal(persist.readState()[`${SLUG}:api`].pid, 1234);
  persist.recordStop(`${SLUG}:api`);
  assert.deepEqual(persist.readState(), {});
});

test("persist - readota o serviço vivo e o Parar encerra o processo", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  try {
    persist.recordStart(`${SLUG}:api`, entry(/** @type {number} */ (child.pid), Date.now()));
    persist.ensureAdopted(noListener);
    const info = runningServices.get(`${SLUG}:api`);
    assert.ok(info, "serviço readotado");
    assert.equal(info.status, "running");
    assert.equal(info.pid, child.pid);
    assert.match(info.logs[0], /readotado/);

    assert.equal(stopService(SLUG, "api").stopped, true);
    assert.ok(await waitDead(/** @type {number} */ (child.pid)), "processo encerrado");
    assert.equal(runningServices.size, 0);
    assert.deepEqual(persist.readState(), {});
  } finally {
    try { child.kill(); } catch {}
  }
});

test("persist - wrapper morto: readota o processo que escuta na porta", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  try {
    persist.recordStart(`${SLUG}:api`, entry(2147483, Date.now()));
    persist.ensureAdopted({ findListener: () => /** @type {number} */ (child.pid), startOf: () => null });
    assert.equal(runningServices.get(`${SLUG}:api`)?.pid, child.pid);
    stopService(SLUG, "api");
    assert.ok(await waitDead(/** @type {number} */ (child.pid)));
  } finally {
    try { child.kill(); } catch {}
  }
});

test("persist - PID morto e porta livre: entrada descartada, nada readotado", () => {
  persist.recordStart(`${SLUG}:api`, entry(2147483, Date.now()));
  persist.ensureAdopted(noListener);
  assert.equal(runningServices.size, 0);
  assert.deepEqual(persist.readState(), {});
});

test("persist - processo mais antigo que o serviço (PID reutilizado) não é readotado", () => {
  const startedAt = Date.now();
  persist.recordStart(`${SLUG}:api`, entry(process.pid, startedAt));
  persist.ensureAdopted({ findListener: () => null, startOf: () => startedAt - 3600000 });
  assert.equal(runningServices.size, 0);
});

test("persist - pruneAdoptedDead remove readotado cujo processo terminou", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  persist.recordStart(`${SLUG}:api`, entry(/** @type {number} */ (child.pid), Date.now()));
  persist.ensureAdopted(noListener);
  assert.equal(runningServices.size, 1);
  child.kill();
  assert.ok(await waitDead(/** @type {number} */ (child.pid)));
  persist.pruneAdoptedDead();
  assert.equal(runningServices.size, 0);
  assert.deepEqual(persist.readState(), {});
});

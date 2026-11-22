// @ts-check
// EP-23.05: safe restart of the engine host. Draining refuses new runs with host-restarting and waits for the
// active ones; past the limit a forced restart ends them as interrupted; the CLI asks before forcing; the browser
// keeps the refused message in the composer and shows a "Reconectando" banner while it reattaches.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-drain-"));
for (const dir of ["projects/demo", "global"]) fs.mkdirSync(path.join(TMP, dir), { recursive: true });
Object.assign(process.env, {
  HARNESS_ROOT: TMP,
  HARNESS_DB_PATH: path.join(TMP, "harness.sqlite"),
  HARNESS_ENGINE_HOST_TOKEN_FILE: path.join(TMP, "engine-host.token"),
  HARNESS_ENGINE_HOST_AUTOSTART: "0",
  HIA_ROUTING_ENABLED: "false",
});

const { createDrain } = require("../ui/server/services/engine-host/drain");
const { createTestDatabase } = require("../ui/server/db/connection");
const { createChatRunsRepo } = require("../ui/server/db/repos/chat-runs.repo");
const journal = require("../ui/server/services/chat-run-journal.service");
const { registerRun, resetRunsForTests } = require("../ui/server/services/chat-run-registry.service");
const { startEngineHost } = require("../ui/engine-host");
const { readToken, TOKEN_HEADER } = require("../ui/server/services/engine-host/protocol");
const { restartRunningHost } = require("../ui/server/services/engine-host/restart-cli");
const banner = await import("../ui/public/js/modules/chat-connection-banner.js");

test.after(() => {
  journal.setJournal(undefined);
  require("../ui/server/db/connection").closeDb();
  require("./helpers/temp-dir").removeDir(TMP);
});

const wait = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("draining refuses new runs and restarts once the active run is done", async () => {
  let active = ["r1"];
  let restarted = 0;
  const drain = createDrain({ onIdle: () => restarted++, activeRuns: () => active, pollMs: 10, limitMs: 60_000 });
  assert.equal(drain.refusing(), false);
  assert.equal(drain.begin().state, "draining");
  assert.equal(drain.refusing(), true);
  await wait(40);
  assert.equal(restarted, 0, "waits while a run is active");
  active = [];
  await wait(40);
  assert.equal(restarted, 1);
  assert.equal(drain.status().state, "restarting");
});

test("past the limit it waits for a decision; force interrupts the active runs, cancel accepts runs again", async () => {
  const interrupted = [];
  let restarted = 0;
  const drain = createDrain({ onIdle: () => restarted++, activeRuns: () => ["a", "b"], interruptRun: (id) => interrupted.push(id), pollMs: 5, limitMs: 20 });
  drain.begin();
  await wait(60);
  assert.equal(drain.status().state, "timed-out");
  assert.equal(drain.refusing(), true, "still refusing while waiting for the decision");
  assert.equal(restarted, 0);
  const other = createDrain({ onIdle: () => {}, activeRuns: () => ["x"], pollMs: 5, limitMs: 10 });
  other.begin();
  assert.equal(other.cancel().state, "idle");
  assert.equal(other.refusing(), false);
  drain.force();
  assert.deepEqual(interrupted, ["a", "b"]);
  assert.equal(restarted, 1);
});

test("a forced restart ends a live run as interrupted in the journal, with a restart reason", async () => {
  const repo = createChatRunsRepo(createTestDatabase());
  journal.setJournal(repo);
  resetRunsForTests();
  const run = registerRun("run-forced", { abort() {}, meta: { project: "demo", engine: "claude" } });
  run.push({ type: "text", text: "parcial" });
  await new Promise((resolve) => setImmediate(resolve));
  const drain = createDrain({ onIdle: () => {}, pollMs: 5 }); // real registry: one active run
  drain.begin();
  drain.force();
  assert.equal(repo.getRun("run-forced").status, "interrupted");
  const last = repo.readFrom("run-forced").at(-1);
  assert.equal(last.reason, "restart");
  resetRunsForTests();
});

test("the host answers 503 host-restarting while draining and restarts when idle", async () => {
  journal.setJournal(createChatRunsRepo(createTestDatabase()));
  resetRunsForTests();
  let restarted = 0;
  const server = await startEngineHost({ port: 0, onRestart: () => restarted++ });
  try {
    const base = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}`;
    const headers = { [TOKEN_HEADER]: /** @type {string} */ (readToken()), "Content-Type": "application/json" };
    const run = registerRun("run-live", { abort() {}, meta: { project: "demo", engine: "claude" } });
    const begin = await fetch(`${base}/admin/restart`, { method: "POST", headers, body: "{}" });
    assert.equal(begin.status, 202);
    assert.equal((await begin.json()).state, "draining");
    const refused = await fetch(`${base}/runs`, { method: "POST", headers, body: JSON.stringify({ engine: "claude", prompt: "oi", slug: "demo" }) });
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).code, "host-restarting");
    assert.equal((await (await fetch(`${base}/health`, { headers })).json()).drain, "draining");
    assert.equal(restarted, 0, "the active run is still going");
    run.finish();
    await wait(400);
    assert.equal(restarted, 1, "restarted once the run finished");
    assert.equal((await fetch(`${base}/admin/restart`, { headers: { "Content-Type": "application/json" } })).status, 401, "token required");
  } finally {
    server.closeAllConnections();
    server.close();
    resetRunsForTests();
  }
});

test("host:restart asks before forcing past the limit; no answer means cancel", async () => {
  journal.setJournal(createChatRunsRepo(createTestDatabase()));
  resetRunsForTests();
  process.env.HARNESS_HOST_DRAIN_MS = "1";
  let restarted = 0;
  const server = await startEngineHost({ port: 0, onRestart: () => restarted++ });
  const previousPort = process.env.HARNESS_ENGINE_HOST_PORT;
  process.env.HARNESS_ENGINE_HOST_PORT = String(/** @type {any} */ (server.address()).port);
  try {
    registerRun("run-stuck", { abort() {}, meta: { project: "demo", engine: "claude" } });
    /** @type {string[]} */
    const lines = [];
    const questions = [];
    await restartRunningHost([], { log: (l) => lines.push(l), ask: async (q) => { questions.push(q); return false; } });
    assert.equal(questions.length, 1, "asked once");
    assert.match(lines.join("\n"), /cancelled/);
    assert.equal(restarted, 0);
    await restartRunningHost([], { log: () => {}, ask: async () => true });
    assert.equal(restarted, 1, "forced after a yes");
  } finally {
    delete process.env.HARNESS_HOST_DRAIN_MS;
    if (previousPort === undefined) delete process.env.HARNESS_ENGINE_HOST_PORT;
    else process.env.HARNESS_ENGINE_HOST_PORT = previousPort;
    server.closeAllConnections();
    server.close();
    resetRunsForTests();
  }
});

test("browser: a refused message returns to the composer; the banner text shows the attempt", () => {
  const assistant = { role: "assistant", text: "" };
  const turns = [{ role: "user", text: "antes" }, { role: "assistant", text: "ok" }, { role: "user", text: "pergunta nova" }, assistant];
  const input = { value: "" };
  banner.returnToComposer(turns, assistant, "pergunta nova", input);
  assert.equal(input.value, "pergunta nova");
  assert.deepEqual(turns.map((t) => t.text), ["antes", "ok"], "the refused turns are gone, the rest stays");
  const typing = { value: "o usuário já digitou outra coisa" };
  banner.returnToComposer([], {}, "x", typing);
  assert.equal(typing.value, "o usuário já digitou outra coisa", "never overwrites new text");
  assert.equal(banner.reconnectText(1), "Reconectando ao servidor");
  assert.equal(banner.reconnectText(3), "Reconectando ao servidor (tentativa 3)");
  assert.doesNotThrow(() => { banner.showReconnecting(2); banner.hideReconnecting(); }, "no DOM in node: no-op");
});

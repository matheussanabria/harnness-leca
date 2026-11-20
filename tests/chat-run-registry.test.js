// EP-23.02: the chat run registry writes every event to the journal before publishing it, and a run that left
// memory (ended long ago, or the server restarted) is still served by GET /api/chat/attach.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

process.env.HARNESS_ENGINE_HOST = "0"; // the attach test calls the in-process route (EP-23.03 legacy mode)
const { createTestDatabase, closeDb } = require("../ui/server/db/connection");
const { createChatRunsRepo } = require("../ui/server/db/repos/chat-runs.repo");
const journal = require("../ui/server/services/chat-run-journal.service");
const { registerRun, resetRunsForTests } = require("../ui/server/services/chat-run-registry.service");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-run-journal-"));
test.after(() => {
  journal.setJournal(undefined);
  closeDb();
  fs.rmSync(TMP, { recursive: true, force: true });
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Minimal ServerResponse stand-in that records SSE events. */
function fakeRes(onWrite = (_event) => {}) {
  const res = {
    events: [], writableEnded: false, destroyed: false, status: 0, handlers: {},
    writeHead(status) { res.status = status; },
    flushHeaders() {},
    on(name, fn) { res.handlers[name] = fn; },
    write(chunk) {
      const line = String(chunk);
      if (line.startsWith("data: ")) { const event = JSON.parse(line.slice(6)); res.events.push(event); onWrite(event); }
    },
    // A real response emits "close" after end(); the registry clears its heartbeat there.
    end() { res.writableEnded = true; res.handlers.close?.(); },
  };
  return res;
}

function memoryJournal() {
  const db = createTestDatabase();
  const repo = createChatRunsRepo(db);
  journal.setJournal(repo);
  return { db, repo };
}

test("an event is in the journal before any subscriber sees it", async () => {
  const { db, repo } = memoryJournal();
  try {
    const seen = [];
    const run = registerRun("w1", { abort() {}, meta: { project: "p", engine: "claude" } });
    run.attach(/** @type {any} */ (fakeRes((event) => seen.push(repo.readFrom("w1", event.seq).length > 0))), 0);
    run.push({ type: "text", text: "a" });
    run.push({ type: "text", text: "b" });
    assert.deepEqual(seen, [], "nothing is published in the same tick");
    await tick();
    run.push({ type: "done" });
    run.finish();
    assert.deepEqual(seen, [true, true, true]);
    assert.equal(repo.getRun("w1").status, "completed");
    assert.equal(repo.getRun("w1").engine, "claude");
  } finally {
    db.close();
  }
});

test("a run that ended an hour ago still answers the attach with its events", async () => {
  const { db } = memoryJournal();
  try {
    const run = registerRun("h1", { abort() {} });
    run.push({ type: "run", runId: "h1" });
    run.push({ type: "text", text: "resposta completa" });
    run.push({ type: "done" });
    run.finish();
    db.prepare("UPDATE chat_runs SET ended_at = ? WHERE run_id = 'h1'").run(new Date(Date.now() - 3600_000).toISOString());
    resetRunsForTests();
    const { chatStreamRoutes } = require("../ui/server/controllers/chat.controller");
    const attach = chatStreamRoutes.find((r) => r.path === "/api/chat/attach").handler;
    const res = fakeRes();
    await attach({ res, url: new URL("http://x/api/chat/attach?runId=h1&from=1") });
    assert.equal(res.status, 200);
    assert.deepEqual(res.events.map((e) => e.type), ["text", "done"]);
    assert.ok(res.writableEnded);
    const missing = fakeRes();
    await attach({ res: missing, url: new URL("http://x/api/chat/attach?runId=never&from=0") });
    assert.equal(missing.status, 404, "404 only for a run that never existed");
  } finally {
    db.close();
  }
});

test("after a restart the attach returns the partial answer and the interrupted state", () => {
  const file = path.join(TMP, "restart.sqlite");
  // Process 1: starts a run, streams part of it and dies without finishing.
  const script = `
    const { registerRun } = require(${JSON.stringify(path.join(__dirname, "../ui/server/services/chat-run-registry.service"))});
    const run = registerRun("rs1", { abort() {}, meta: { project: "p", engine: "codex" } });
    run.push({ type: "text", text: "parte 1" });
    run.push({ type: "text", text: "parte 2" });
    setImmediate(() => process.exit(0));`;
  execFileSync(process.execPath, ["-e", script], { env: { ...process.env, HARNESS_DB_PATH: file } });

  // Process 2 (this one): opens the same file lazily, as the restarted server would.
  const prev = process.env.HARNESS_DB_PATH;
  process.env.HARNESS_DB_PATH = file;
  try {
    closeDb();
    journal.setJournal(undefined);
    const stored = journal.readStoredRun("rs1", 0);
    assert.equal(stored.status, "interrupted");
    assert.deepEqual(stored.events.map((e) => e.text || e.code), ["parte 1", "parte 2", "interrupted"]);
    assert.equal(stored.events[2].type, "error");
    assert.equal(stored.events[2].seq, 2);
  } finally {
    journal.setJournal(undefined);
    closeDb();
    if (prev === undefined) delete process.env.HARNESS_DB_PATH;
    else process.env.HARNESS_DB_PATH = prev;
  }
});

test("no secret reaches the journal", () => {
  const { db } = memoryJournal();
  const secret = "fake-secret-value-0123456789";
  // Built at runtime so the literal never sits in the source (secret scanners).
  const keyLike = ["sk", "ant", "abcdefghijklmnopqrstuvwxyz"].join("-");
  process.env.HARNESS_FAKE_API_TOKEN = secret;
  try {
    const run = registerRun("s1", { abort() {} });
    run.push({ type: "text", text: `token is ${secret}`, nested: { list: [secret] } });
    run.push({ type: "text", text: `key ${keyLike}` });
    run.push({ type: "done" });
    run.finish();
    const dump = db.prepare("SELECT payload FROM chat_run_events").all().map((r) => r.payload).join("\n");
    assert.ok(!dump.includes(secret), "env value is scrubbed");
    assert.ok(!dump.includes(keyLike), "known key format is scrubbed");
    assert.match(dump, /REDIGIDO:env/);
  } finally {
    delete process.env.HARNESS_FAKE_API_TOKEN;
    db.close();
  }
});

test("HARNESS_RUN_JOURNAL=0 keeps the memory-only behaviour", () => {
  const prev = process.env.HARNESS_RUN_JOURNAL;
  process.env.HARNESS_RUN_JOURNAL = "0";
  journal.setJournal(undefined);
  try {
    assert.equal(journal.getJournal(), null);
    const res = fakeRes();
    const run = registerRun("m1", { abort() {} });
    run.attach(/** @type {any} */ (res), 0);
    run.push({ type: "text", text: "x" });
    run.push({ type: "done" });
    run.finish();
    assert.deepEqual(res.events.map((e) => e.type), ["text", "done"]);
    assert.equal(journal.readStoredRun("m1", 0), null);
  } finally {
    if (prev === undefined) delete process.env.HARNESS_RUN_JOURNAL;
    else process.env.HARNESS_RUN_JOURNAL = prev;
    journal.setJournal(undefined);
  }
});

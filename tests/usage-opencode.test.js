// @ts-check
// OpenCode read-only usage reader: layout choice, 9router dedupe, bounds, sentinels and degradation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { createOpenCodeReader, defaultDbPath } = require("../ui/server/services/usage-ingest/opencode-reader");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");

const SENTINEL_TEXT = "SENTINEL-PROMPT-TEXT-XYZ";
const SENTINEL_TITLE = "SENTINEL-SESSION-TITLE-XYZ";
const SENTINEL_KEY = "sk-SENTINEL-OPENCODE-KEY-123"; // allow-secret: fake sentinel proving text is never selected
const quiet = () => {};

/** @param {number} created @param {string} provider @param {string} model @param {any} [extra] */
function assistantData(created, provider, model, extra = {}) {
  return JSON.stringify({
    role: "assistant", providerID: provider, modelID: model, cost: 0.5,
    tokens: { input: 10, output: 5, reasoning: 2, cache: { read: 7, write: 3 } },
    time: { created }, text: SENTINEL_TEXT, ...extra,
  });
}

/** Builds a v1 (message) DB, optionally with the v2 (session_message) table holding different counts. */
function makeDb({ v2 = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-"));
  const file = path.join(dir, "opencode.db");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE session (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT);
    CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, data TEXT);`);
  if (v2) db.exec(`
    CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, seq INTEGER, time_created INTEGER, data TEXT);`);
  db.prepare("INSERT INTO session VALUES ('s1', ?)").run(SENTINEL_TITLE);
  db.prepare("INSERT INTO part VALUES ('p1','m0',?)").run(SENTINEL_KEY);
  const m = db.prepare("INSERT INTO message VALUES (?,?,?,?,?)");
  m.run("m0", "s1", 1, 1, JSON.stringify({ role: "user", text: SENTINEL_TEXT }));
  m.run("m1", "s1", 1000, 1000, assistantData(1000, "openrouter", "gpt-x"));
  m.run("m2", "s1", 2000, 2000, assistantData(2000, "openrouter", "gpt-x", { error: { message: SENTINEL_KEY } }));
  m.run("m3", "s1", 3000, 3000, assistantData(3000, "9router", "combo-a"));
  if (v2) {
    const s = db.prepare("INSERT INTO session_message VALUES (?,?,?,?,?,?)");
    const body = (/** @type {string} */ p, /** @type {string} */ id) => JSON.stringify({
      model: { providerID: p, id }, cost: 1, content: [SENTINEL_TEXT],
      tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 1, write: 2 } },
    });
    s.run("a1", "s1", "assistant", 1, 5000, body("openrouter", "gpt-x"));
    s.run("a2", "s1", "assistant", 2, 6000, body("9router", "combo-a"));
    s.run("u1", "s1", "user", 3, 7000, JSON.stringify({ content: SENTINEL_TEXT }));
  }
  db.close();
  return { file, dir };
}

test("v1 layout: aggregates per provider/model, failures via json_type, router excluded from totals", () => {
  const out = createOpenCodeReader({ dbPath: makeDb().file, warn: quiet }).read();
  assert.equal(out.layout, "v1");
  assert.deepEqual(out.warnings, []);
  const gpt = out.stats.find((s) => s.model === "gpt-x");
  assert.deepEqual(
    [gpt?.source, gpt?.calls, gpt?.tokensIn, gpt?.tokensOut, gpt?.tokensReasoning, gpt?.cacheRead, gpt?.cacheWrite, gpt?.cost, gpt?.failures, gpt?.viaRouter],
    ["opencode", 2, 20, 10, 4, 14, 6, 1, 1, false],
  );
  assert.equal(gpt?.lastAt, new Date(2000).toISOString());
  assert.equal(out.stats.find((s) => s.provider === "9router")?.viaRouter, true);
  assert.equal(out.total.calls, 2);
  assert.equal(out.viaRouter.calls, 1);
});

test("v2 layout wins and v1 is not double counted", () => {
  const out = createOpenCodeReader({ dbPath: makeDb({ v2: true }).file, warn: quiet }).read();
  assert.equal(out.layout, "v2");
  assert.equal(out.total.calls, 1);
  assert.equal(out.total.tokensIn, 100);
  assert.equal(out.viaRouter.calls, 1);
});

test("sentinel text, titles and keys never appear in output", () => {
  const out = JSON.stringify(createOpenCodeReader({ dbPath: makeDb({ v2: true }).file, warn: quiet }).read());
  for (const s of [SENTINEL_TEXT, SENTINEL_TITLE, SENTINEL_KEY]) assert.equal(out.includes(s), false);
  const v1 = JSON.stringify(createOpenCodeReader({ dbPath: makeDb().file, warn: quiet }).read());
  for (const s of [SENTINEL_TEXT, SENTINEL_TITLE, SENTINEL_KEY]) assert.equal(v1.includes(s), false);
});

test("bounded ticks keep a checkpoint and never re-count rows", () => {
  const r = createOpenCodeReader({ dbPath: makeDb().file, maxRows: 2, warn: quiet });
  assert.deepEqual(r.tick(), { rows: 2, done: false });
  const out = r.read();
  assert.equal(out.total.calls + out.viaRouter.calls, 3);
  assert.equal(r.read().total.calls, 2);
});

test("missing, garbage or table-less DB degrades without throwing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-bad-"));
  const garbage = path.join(dir, "garbage.db");
  fs.writeFileSync(garbage, "not a sqlite file at all");
  const empty = path.join(dir, "empty.db");
  new DatabaseSync(empty).close();
  for (const p of [path.join(dir, "missing.db"), garbage, empty]) {
    const out = createOpenCodeReader({ dbPath: p, warn: quiet }).read();
    assert.deepEqual(out.stats, []);
    assert.equal(out.total.calls, 0);
    assert.equal(out.warnings.length, 1);
  }
});

test("defaultDbPath honours HARNESS_OPENCODE_DB and the route is registered", () => {
  assert.equal(defaultDbPath({ HARNESS_OPENCODE_DB: "/x/y.db" }), "/x/y.db");
  assert.match(defaultDbPath({}), /opencode[\\/]opencode\.db$/);
  assert.ok(centralEventRoutes.some((r) => r.method === "GET" && r.path.test("/api/usage/opencode")));
});

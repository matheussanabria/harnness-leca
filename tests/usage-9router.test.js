// @ts-check
// 9Router read-only ingestor: aggregation, checkpoint, bounds, degradation and secret sentinels.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { createNineRouterReader, defaultDbPath } = require("../ui/server/services/usage-ingest/9router-reader");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");

const SECRET_KEY = "sk-SENTINEL-APIKEY-123"; // allow-secret: fake sentinel proving the reader never selects apiKey
const SECRET_DATA = "SENTINEL-CONNECTION-DATA";
const SECRET_KEYS_TBL = "SENTINEL-APIKEYS-KEY";

function makeDb(rows = 3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-"));
  const file = path.join(dir, "data.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE usageHistory (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, provider TEXT, model TEXT,
    connectionId TEXT, apiKey TEXT, endpoint TEXT, promptTokens INTEGER, completionTokens INTEGER, cost REAL, status TEXT, tokens TEXT, meta TEXT);
    CREATE TABLE usageDaily (dateKey TEXT, data TEXT);
    CREATE TABLE combos (id TEXT, name TEXT, kind TEXT, models TEXT);
    CREATE TABLE providerConnections (id TEXT, data TEXT);
    CREATE TABLE apiKeys (id TEXT, key TEXT);`);
  db.prepare("INSERT INTO combos VALUES ('c1','harness-impl','x','[]')").run();
  db.prepare("INSERT INTO providerConnections VALUES ('p',?)").run(SECRET_DATA);
  db.prepare("INSERT INTO apiKeys VALUES ('k',?)").run(SECRET_KEYS_TBL);
  addRows(db, rows);
  db.close();
  return { file, dir };
}

/** @param {any} db @param {number} n */
function addRows(db, n) {
  const ins = db.prepare("INSERT INTO usageHistory (timestamp,provider,model,apiKey,promptTokens,completionTokens,status) VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < n; i++) ins.run(`2026-11-01T10:0${i % 10}:00Z`, "nvidia", i === 1 ? "harness-impl" : "m1", SECRET_KEY, 10, 5, i === 2 ? "error" : "ok");
}

const quiet = () => {};

test("sums cache counters from the tokens JSON and tolerates bad JSON", () => {
  const { createAggregator } = require("../ui/server/services/usage-ingest/9router-stat-model");
  const agg = createAggregator();
  const base = { provider: "p", model: "m", promptTokens: 100, completionTokens: 1, status: "ok" };
  agg.add({ ...base, tokens: JSON.stringify({ cached_tokens: 60, cache_creation_input_tokens: 5 }) });
  agg.add({ ...base, tokens: "{not json" });
  agg.add({ ...base });
  const [s] = agg.list();
  assert.deepEqual([s.calls, s.tokensIn, s.cacheRead, s.cacheWrite], [3, 300, 60, 5]);
});

test("aggregates per combo/provider/model with failures and lastAt", () => {
  const { file } = makeDb(3);
  const out = createNineRouterReader({ dbPath: file, warn: quiet }).read();
  assert.equal(out.warnings.length, 0);
  const m1 = out.combos.find((c) => c.model === "m1");
  assert.deepEqual([m1?.calls, m1?.tokensIn, m1?.tokensOut, m1?.failures, m1?.combo], [2, 20, 10, 1, ""]);
  assert.equal(out.combos.find((c) => c.combo === "harness-impl")?.calls, 1);
});

test("checkpoint is incremental and rows per tick are bounded", () => {
  const { file } = makeDb(5);
  const r = createNineRouterReader({ dbPath: file, maxRows: 2, warn: quiet });
  assert.equal(r.tick().rows, 2);
  assert.equal(r.checkpoint, 2);
  r.read();
  assert.equal(r.checkpoint, 5);
  const db = new DatabaseSync(file);
  addRows(db, 1);
  db.close();
  const out = r.read();
  assert.equal(out.lastId, 6);
  assert.equal(out.combos.reduce((a, c) => a + c.calls, 0), 6);
});

test("missing DB, missing table and garbage file degrade to empty with a warning", () => {
  const warns = [];
  const w = (m) => warns.push(m);
  assert.deepEqual(createNineRouterReader({ dbPath: path.join(os.tmpdir(), "nope-9r.sqlite"), warn: w }).read().combos, []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-"));
  const empty = path.join(dir, "e.sqlite");
  new DatabaseSync(empty).close();
  const out = createNineRouterReader({ dbPath: empty, warn: w }).read();
  assert.deepEqual(out.combos, []);
  assert.equal(out.warnings.length, 1);
  const junk = path.join(dir, "j.sqlite");
  fs.writeFileSync(junk, "not a database at all");
  assert.deepEqual(createNineRouterReader({ dbPath: junk, warn: w }).read().combos, []);
  assert.equal(warns.length, 3);
});

test("secrets never appear in the output", () => {
  const { file } = makeDb(3);
  const json = JSON.stringify(createNineRouterReader({ dbPath: file, warn: quiet }).read());
  for (const s of [SECRET_KEY, SECRET_DATA, SECRET_KEYS_TBL]) assert.ok(!json.includes(s));
});

test("the DB is opened read-only and the path is configurable via env", () => {
  const { file } = makeDb(1);
  assert.equal(defaultDbPath({ HARNESS_9ROUTER_DB: file }), file);
  createNineRouterReader({ dbPath: file, warn: quiet }).read();
  const db = new DatabaseSync(file);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usageHistory").get()?.n, 1);
  db.close();
});

test("GET /api/usage/combos is registered", () => {
  assert.ok(centralEventRoutes.some((r) => r.method === "GET" && r.path.test("/api/usage/combos")));
});

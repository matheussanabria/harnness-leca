// EP-17.01: GET /api/db/health over the real HTTP server, with a temp database.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-db-health-"));
process.env.HARNESS_DB_PATH = path.join(TMP, "health.sqlite");

const { createServer } = require("../ui/server");
const { closeDb } = require("../ui/server/db/connection");
const { listMigrations } = require("../ui/server/db/migrate");

let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  server.closeAllConnections();
  server.close();
  closeDb();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("GET /api/db/health reports schema version, size and WAL status", async () => {
  const res = await fetch(`${base}/api/db/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  const known = listMigrations();
  assert.equal(body.schemaVersion, known[known.length - 1].number);
  assert.deepEqual(body.migrations, known.map((m) => m.name));
  assert.ok(body.sizeBytes > 0);
  assert.equal(body.wal.journalMode, "wal");
  assert.equal(typeof body.wal.walBytes, "number");
  assert.equal(body.foreignKeys, true);
  assert.equal(body.busyTimeoutMs, 5000);
  assert.equal(body.file, "health.sqlite");
  assert.ok(!JSON.stringify(body).includes(TMP), "never exposes the full path");
});

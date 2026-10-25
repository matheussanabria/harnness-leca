// @ts-check
// OpenCode detection in the legacy agent activity poll: runtime column resolution, read-only, injectable paths.
const os = require("os");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const { getActiveAgentsSummary, countOpenCodeActive } = require("../ui/server/services/agent-activity.service");

const NOW = 1_800_000_000_000;
const MIN = 60 * 1000;
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-agent-activity-"));
const EMPTY_CLAUDE = path.join(TMP_ROOT, "claude-empty");
const MISSING_GEMINI = path.join(TMP_ROOT, "gemini-missing");
fs.mkdirSync(EMPTY_CLAUDE, { recursive: true });

test.after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

/**
 * Creates a sqlite file with a `session` table in the given schema.
 * @param {string} name
 * @param {"ms" | "seconds"} unit
 * @param {Array<{id: string, parent: string | null, updated: number}>} rows
 * @returns {string}
 */
function makeOpenCodeDb(name, unit, rows) {
  const file = path.join(TMP_ROOT, name);
  const db = new DatabaseSync(file);
  const column = unit === "ms" ? "time_updated" : "updated_at";
  db.exec(`CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, directory TEXT, ${column} INTEGER NOT NULL)`);
  const insert = db.prepare(`INSERT INTO session (id, parent_id, directory, ${column}) VALUES (?, ?, ?, ?)`);
  for (const r of rows) {
    insert.run(r.id, r.parent, "/tmp/project", unit === "ms" ? r.updated : Math.floor(r.updated / 1000));
  }
  db.close();
  return file;
}

const ROWS = [
  { id: "fresh-top", parent: null, updated: NOW - 5 * MIN },
  { id: "stale-top", parent: null, updated: NOW - 120 * MIN },
  { id: "fresh-child", parent: "fresh-top", updated: NOW - 2 * MIN },
];

test("time_updated in milliseconds: counts only fresh top-level sessions", () => {
  const file = makeOpenCodeDb("ms-schema.db", "ms", ROWS);
  assert.equal(countOpenCodeActive(file, NOW), 1);
});

test("updated_at in seconds (legacy schema): counts only fresh top-level sessions", () => {
  const file = makeOpenCodeDb("seconds-schema.db", "seconds", ROWS);
  assert.equal(countOpenCodeActive(file, NOW), 1);
});

test("stale session is not counted in either schema", () => {
  const file = makeOpenCodeDb("stale-only.db", "ms", [{ id: "old", parent: null, updated: NOW - 300 * MIN }]);
  assert.equal(countOpenCodeActive(file, NOW), 0);
  const legacy = makeOpenCodeDb("stale-only-s.db", "seconds", [{ id: "old", parent: null, updated: NOW - 300 * MIN }]);
  assert.equal(countOpenCodeActive(legacy, NOW), 0);
});

test("child session (parent_id not null) is not counted", () => {
  const file = makeOpenCodeDb("child-only.db", "ms", [{ id: "child", parent: "root", updated: NOW - MIN }]);
  assert.equal(countOpenCodeActive(file, NOW), 0);
});

test("missing database gives 0 and does not create the file", () => {
  const missing = path.join(TMP_ROOT, "does-not-exist.db");
  assert.equal(countOpenCodeActive(missing, NOW), 0);
  assert.equal(fs.existsSync(missing), false);
});

test("database without a session table gives 0 without throwing", () => {
  const file = path.join(TMP_ROOT, "no-session.db");
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE other (id TEXT)");
  db.close();
  assert.equal(countOpenCodeActive(file, NOW), 0);
});

test("getActiveAgentsSummary reports OpenCode from an injected ms-schema database", () => {
  const file = makeOpenCodeDb("summary-ms.db", "ms", ROWS);
  const summary = getActiveAgentsSummary({
    claudeRoot: EMPTY_CLAUDE,
    geminiBrain: MISSING_GEMINI,
    opencodeDb: file,
    now: NOW,
  });
  assert.equal(summary.agents.opencode.activeCount, 1);
  assert.equal(summary.agents.opencode.status, "active");
  assert.equal(summary.agents.opencode.currentTask, "1 chats ativos");
  assert.equal(summary.agents.gemini.activeCount, 0);
});

test("getActiveAgentsSummary keeps OpenCode idle when the database is missing", () => {
  const summary = getActiveAgentsSummary({
    claudeRoot: EMPTY_CLAUDE,
    geminiBrain: MISSING_GEMINI,
    opencodeDb: path.join(TMP_ROOT, "absent.db"),
    now: NOW,
  });
  assert.equal(summary.agents.opencode.activeCount, 0);
  assert.equal(summary.agents.opencode.status, "idle");
  assert.equal(summary.agents.opencode.currentTask, "Em espera");
});

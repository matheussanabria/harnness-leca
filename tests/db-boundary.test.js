// EP-17.01: static scan. Only the db module, the CLI client and an explicit allowlist may require node:sqlite.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_DIRS = ["ui/server", "ui/server.js", "tools"];
const ALLOWED_PREFIXES = ["ui/server/db/", "tools/lib/db-client.js"];

// Files that already used node:sqlite before EP-17 (readers of tool databases and the legacy event store).
// A new entry needs a written reason in the PR; new persistence goes through ui/server/db/ instead.
const ALLOWLIST = [
  "ui/server/services/events/event-store.js", // legacy per-project event log, consolidated in EP-17.10
  "ui/server/services/agent-activity.service.js", // read-only reader of tool databases
  "ui/server/services/external-presence/presence-sources-db.js", // read-only reader of tool databases
  "ui/server/services/orchestration/adapters/opencode-adapter.js", // read-only reader of opencode.db
  "ui/server/services/usage-ingest/9router-reader.js", // read-only reader of 9Router data.sqlite
  "ui/server/services/usage-ingest/opencode-reader.js", // read-only reader of opencode.db
  "tools/import-opencode-chats.js", // read-only importer of opencode.db
  "tools/lib/sync-core.js", // read-only importer of opencode.db
  "tools/sync.js", // lazy require of the opencode importer database (pre-existing)
];

const REQUIRE_RE = /\b(?:require\(\s*["']node:sqlite["']\s*\)|from\s+["']node:sqlite["']|import\(\s*["']node:sqlite["']\s*\)(?!\s*\.))/;

function walk(rel, out = []) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  if (fs.statSync(abs).isFile()) {
    if (/\.(c|m)?js$/.test(abs)) out.push(rel);
    return out;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    walk(`${rel}/${entry.name}`, out);
  }
  return out;
}

test("no node:sqlite require outside ui/server/db, db-client and the allowlist", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  assert.ok(files.length > 50, "scan found the source tree");
  const offenders = files.filter((rel) => {
    if (ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p))) return false;
    if (ALLOWLIST.includes(rel)) return false;
    return REQUIRE_RE.test(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  });
  assert.deepEqual(offenders, [], "use ui/server/db/connection.js (or tools/lib/db-client.js) instead of node:sqlite");
});

test("every allowlisted file exists and still needs its entry", () => {
  for (const rel of ALLOWLIST) {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} no longer exists: remove it from the allowlist`);
    assert.match(fs.readFileSync(abs, "utf8"), /node:sqlite/, `${rel} no longer uses node:sqlite: remove it from the allowlist`);
  }
});

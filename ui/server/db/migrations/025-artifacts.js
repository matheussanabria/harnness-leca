// @ts-check
// 025: artifact registry (EP-25.03, ADR-019). Each artifact has a stable id, a type and an owner; the owner is
// data, so moving an artifact between projects never changes its identity. The file list records where the
// content lives and its hash. The ownership log keeps every create, move and copy.

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec(`CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    owner_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    derived_from TEXT REFERENCES artifacts (id),
    source_key TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec("CREATE INDEX artifacts_owner_idx ON artifacts (owner_slug, type)");
  db.exec("CREATE INDEX artifacts_derived_idx ON artifacts (derived_from) WHERE derived_from IS NOT NULL");
  db.exec(`CREATE TABLE artifact_files (
    artifact_id TEXT NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content_hash TEXT,
    PRIMARY KEY (artifact_id, path)
  )`);
  db.exec(`CREATE TABLE artifact_ownership_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id TEXT NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
    from_owner TEXT,
    to_owner TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'move', 'copy')),
    at TEXT NOT NULL,
    actor TEXT NOT NULL
  )`);
  db.exec("CREATE INDEX artifact_log_artifact_idx ON artifact_ownership_log (artifact_id, id)");
}

module.exports = { up };

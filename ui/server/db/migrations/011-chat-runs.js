// @ts-check
// 011: chat run journal (EP-23.02). Every event of a chat run is written here before it reaches the browser,
// so a reattach still works after the run left memory or the web server restarted.
// Owner: the web server for now; the engine host takes over in EP-23.03 (ui/server/db/owners.js).

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec(`CREATE TABLE chat_runs (
    run_id TEXT PRIMARY KEY,
    project TEXT,
    chat_id TEXT,
    engine TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'stopped', 'interrupted')),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    last_seq INTEGER NOT NULL DEFAULT -1
  )`);
  db.exec("CREATE INDEX chat_runs_status_idx ON chat_runs (status, ended_at)");
  db.exec(`CREATE TABLE chat_run_events (
    run_id TEXT NOT NULL REFERENCES chat_runs (run_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    type TEXT,
    payload TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  ) WITHOUT ROWID`);
}

module.exports = { up };

// @ts-check
// 002: chat conversations, engine sessions and messages (EP-17.02). The server, not the browser, keeps which engine
// session belongs to each conversation, so a hard refresh or another browser resumes the same session.
// source_file links a conversation to its projects/<slug>/chats/*.md file (the legacy store, still written).
// Owner: the web server (ui/server/db/owners.js); the engine host only reads.

/** @param {import("node:sqlite").DatabaseSync} db */
function up(db) {
  db.exec(`CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT,
    presentation TEXT,
    source_file TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`);
  db.exec("CREATE UNIQUE INDEX chat_conversations_file_idx ON chat_conversations (project_id, source_file) WHERE source_file IS NOT NULL");
  db.exec("CREATE INDEX chat_conversations_recent_idx ON chat_conversations (project_id, updated_at)");
  db.exec(`CREATE TABLE chat_engine_sessions (
    conversation_id TEXT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
    engine TEXT NOT NULL,
    engine_session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (conversation_id, engine)
  ) WITHOUT ROWID`);
  db.exec(`CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    engine TEXT,
    content TEXT NOT NULL,
    thinking TEXT,
    tool_events TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (conversation_id, seq)
  )`);
}

module.exports = { up };

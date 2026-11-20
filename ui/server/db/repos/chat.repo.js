// @ts-check
// Chat conversations repository (EP-17.02, migration 002). The server assigns message seq inside one short
// transaction, so concurrent appends never collide. Receives the connection by injection; never requires node:sqlite.
const crypto = require("crypto");
const { createRepoBase } = require("../repo-base");

/** @typedef {{ id: string, projectId: string, title: string|null, presentation: string|null, sourceFile: string|null, createdAt: string, updatedAt: string, archivedAt: string|null }} Conversation */
/** @typedef {{ role: "user"|"assistant", engine?: string|null, content: string, thinking?: string|null, toolEvents?: any }} NewMessage */
/** @typedef {NewMessage & { id: number, seq: number, createdAt: string }} StoredMessage */
/** @typedef {{ engine: string, engineSessionId: string, status: "active"|"expired", updatedAt: string }} EngineSession */

const now = () => new Date().toISOString();

/** @param {any} row @returns {Conversation} */
const toConversation = (row) => ({
  id: String(row.id),
  projectId: String(row.project_id),
  title: row.title ?? null,
  presentation: row.presentation ?? null,
  sourceFile: row.source_file ?? null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  archivedAt: row.archived_at ?? null,
});

/** @param {import("node:sqlite").DatabaseSync} db */
function createChatRepo(db) {
  const { prepare, transaction, toJson, fromJson } = createRepoBase(db);

  /** @param {{ projectId: string, title?: string|null, presentation?: string|null, sourceFile?: string|null }} input @returns {Conversation} */
  function createConversation({ projectId, title = null, presentation = null, sourceFile = null }) {
    const id = crypto.randomUUID();
    const at = now();
    prepare(`INSERT INTO chat_conversations (id, project_id, title, presentation, source_file, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, title, presentation, sourceFile, at, at);
    return /** @type {Conversation} */ (getConversation(id));
  }

  /** @param {string} id @returns {Conversation|null} */
  function getConversation(id) {
    const row = prepare("SELECT * FROM chat_conversations WHERE id = ?").get(id);
    return row ? toConversation(row) : null;
  }

  /** @param {string} projectId @param {string} sourceFile @returns {Conversation|null} */
  function findByFile(projectId, sourceFile) {
    const row = prepare("SELECT * FROM chat_conversations WHERE project_id = ? AND source_file = ?").get(projectId, sourceFile);
    return row ? toConversation(row) : null;
  }

  /** Finds the conversation of a .md file, creating it on first sight (idempotent by project + file). */
  function ensureForFile(/** @type {string} */ projectId, /** @type {string} */ sourceFile, /** @type {{ title?: string|null }} */ extra = {}) {
    return transaction(() => findByFile(projectId, sourceFile) || createConversation({ projectId, sourceFile, title: extra.title ?? null }));
  }

  /** Newest first. @param {string} projectId @param {{ includeArchived?: boolean, limit?: number }} [options] */
  function listConversations(projectId, { includeArchived = false, limit = 50 } = {}) {
    const sql = `SELECT * FROM chat_conversations WHERE project_id = ? ${includeArchived ? "" : "AND archived_at IS NULL"}
      ORDER BY updated_at DESC, rowid DESC LIMIT ?`;
    return prepare(sql).all(projectId, Math.max(1, Math.min(200, limit))).map(toConversation);
  }

  /** @param {string} id @param {{ title?: string, archived?: boolean, presentation?: string }} patch @returns {Conversation|null} */
  function updateConversation(id, patch) {
    const at = now();
    transaction(() => {
      if (typeof patch.title === "string") prepare("UPDATE chat_conversations SET title = ? WHERE id = ?").run(patch.title, id);
      if (typeof patch.presentation === "string") prepare("UPDATE chat_conversations SET presentation = ? WHERE id = ?").run(patch.presentation, id);
      if (typeof patch.archived === "boolean") prepare("UPDATE chat_conversations SET archived_at = ? WHERE id = ?").run(patch.archived ? at : null, id);
      prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(at, id);
    });
    return getConversation(id);
  }

  /** @param {string} conversationId @param {string} engine @param {string} engineSessionId @param {"active"|"expired"} [status] */
  function setEngineSession(conversationId, engine, engineSessionId, status = "active") {
    const at = now();
    transaction(() => {
      prepare(`INSERT INTO chat_engine_sessions (conversation_id, engine, engine_session_id, status, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (conversation_id, engine) DO UPDATE SET engine_session_id = excluded.engine_session_id,
        status = excluded.status, updated_at = excluded.updated_at`).run(conversationId, engine, engineSessionId, status, at);
      prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(at, conversationId);
    });
  }

  /** @param {string} conversationId @returns {EngineSession[]} */
  function getEngineSessions(conversationId) {
    return prepare("SELECT * FROM chat_engine_sessions WHERE conversation_id = ? ORDER BY engine").all(conversationId).map((row) => ({
      engine: String(row.engine),
      engineSessionId: String(row.engine_session_id),
      status: /** @type {"active"|"expired"} */ (row.status),
      updatedAt: String(row.updated_at),
    }));
  }

  /**
   * Appends messages in one transaction; seq continues from the highest stored one.
   * @param {string} conversationId @param {NewMessage[]} messages @returns {number[]} the assigned seqs
   */
  function appendMessages(conversationId, messages) {
    if (!messages.length) return [];
    return transaction(() => {
      const top = /** @type {any} */ (prepare("SELECT COALESCE(MAX(seq), -1) AS top FROM chat_messages WHERE conversation_id = ?").get(conversationId));
      let seq = Number(top.top);
      const at = now();
      const insert = prepare(`INSERT INTO chat_messages (conversation_id, seq, role, engine, content, thinking, tool_events, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const seqs = [];
      for (const m of messages) {
        seq += 1;
        insert.run(conversationId, seq, m.role, m.engine ?? null, String(m.content ?? ""), m.thinking || null, toJson(m.toolEvents), at);
        seqs.push(seq);
      }
      prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(at, conversationId);
      return seqs;
    });
  }

  /** @param {string} conversationId */
  function countMessages(conversationId) {
    return Number(/** @type {any} */ (prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ?").get(conversationId)).n);
  }

  /** Page of messages with seq > after, in order. @param {string} conversationId @param {{ after?: number, limit?: number }} [page] @returns {StoredMessage[]} */
  function readMessages(conversationId, { after = -1, limit = 200 } = {}) {
    return prepare("SELECT * FROM chat_messages WHERE conversation_id = ? AND seq > ? ORDER BY seq LIMIT ?")
      .all(conversationId, after, Math.max(1, Math.min(1000, limit)))
      .map((row) => ({
        id: Number(row.id),
        seq: Number(row.seq),
        role: /** @type {"user"|"assistant"} */ (row.role),
        engine: row.engine ?? null,
        content: String(row.content),
        thinking: row.thinking ?? null,
        toolEvents: fromJson(row.tool_events),
        createdAt: String(row.created_at),
      }));
  }

  return { createConversation, getConversation, findByFile, ensureForFile, listConversations, updateConversation, setEngineSession, getEngineSessions, appendMessages, countMessages, readMessages, transaction };
}

module.exports = { createChatRepo };

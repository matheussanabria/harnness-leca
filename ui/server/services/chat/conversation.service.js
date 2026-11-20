// @ts-check
// Chat conversations in the host database (EP-17.02). The server keeps each conversation's engine sessions and
// messages, so a hard refresh, cleared storage or another browser resumes the same engine session.
// The .md files in projects/<slug>/chats/ are still written (legacy store, rollback path); a conversation is
// linked to its file by source_file. Content is redacted on write with the same rules as the .md files.
// HARNESS_CHAT_STORE=file turns the database off (rollback). Fails open: a database error never breaks the chat.
const { getDb } = require("../../db/connection");
const { createChatRepo } = require("../../db/repos/chat.repo");
const { redact } = require("../../../../tools/lib/redact");

const ENGINES = new Set(["claude", "opencode", "gemini", "codex", "ollama"]);
const SESSION_ID = /^[\w.:-]{1,200}$/;
const CHAT_FILE = /^[\w.-]{1,200}\.md$/;

/** @typedef {ReturnType<typeof createChatRepo>} ChatRepo */
/** @type {ChatRepo | null | undefined} undefined = not opened yet */
let store;

/** @param {string} where @param {unknown} error */
function warn(where, error) {
  console.warn(`[chat-store] ${where}:`, (error && /** @type {any} */ (error).message) || error);
}

const enabled = () => process.env.HARNESS_CHAT_STORE !== "file";

/** @returns {ChatRepo | null} the repository, or null when disabled or unavailable */
function getStore() {
  if (!enabled()) return null;
  if (store !== undefined) return store;
  try {
    store = createChatRepo(getDb());
  } catch (error) {
    warn("open", error);
    store = null;
  }
  return store;
}

/** Tests inject a repository (or null to disable); undefined resets to lazy opening. */
function setStore(/** @type {ChatRepo | null | undefined} */ repo) {
  store = repo;
}

const isEngine = (/** @type {unknown} */ e) => typeof e === "string" && ENGINES.has(e);
const isSessionId = (/** @type {unknown} */ s) => typeof s === "string" && SESSION_ID.test(s);
const isChatFile = (/** @type {unknown} */ f) => typeof f === "string" && CHAT_FILE.test(f);
const clean = (/** @type {unknown} */ text) => redact(String(text ?? ""));

/** @param {ChatRepo} repo @param {import("../../db/repos/chat.repo").Conversation} conversation */
function describe(repo, conversation) {
  /** @type {Record<string, string>} */
  const sessions = {};
  for (const s of repo.getEngineSessions(conversation.id)) if (s.status === "active") sessions[s.engine] = s.engineSessionId;
  return { ...conversation, sessions, messageCount: repo.countMessages(conversation.id) };
}

/** UI turn ({ role, text, engine, thinking }) to a stored message, redacted. */
function toMessage(/** @type {any} */ turn) {
  const role = turn && turn.role === "user" ? "user" : "assistant";
  return {
    role: /** @type {"user"|"assistant"} */ (role),
    engine: role === "assistant" && isEngine(turn.engine) ? turn.engine : null,
    content: clean(turn && turn.text),
    thinking: turn && turn.thinking ? clean(turn.thinking) : null,
  };
}

/**
 * Mirrors a POST /api/chat/save into the database: links the conversation to its .md file, records the engine
 * session and appends only the turns not stored yet (saving again is idempotent).
 * @param {{ slug: string, fileName: string, title?: string, engine?: string, sessionId?: string, turns: any[] }} save
 * @returns {string|null} the conversation id, or null when the store is off or failed
 */
function recordSave({ slug, fileName, title, engine, sessionId, turns }) {
  const repo = getStore();
  if (!repo || !isChatFile(fileName)) return null;
  try {
    return repo.transaction(() => {
      const conversation = repo.ensureForFile(slug, fileName, { title: title || null });
      if (title && title !== conversation.title) repo.updateConversation(conversation.id, { title: String(title).slice(0, 200) });
      if (isEngine(engine) && isSessionId(sessionId)) repo.setEngineSession(conversation.id, String(engine), String(sessionId));
      const turnsToStore = turns.filter((t) => t && (t.role === "user" || t.role === "assistant"));
      repo.appendMessages(conversation.id, turnsToStore.slice(repo.countMessages(conversation.id)).map(toMessage));
      return conversation.id;
    });
  } catch (error) {
    warn("save", error);
    return null;
  }
}

/** @param {string} slug @param {string} fileName */
function conversationForFile(slug, fileName) {
  const repo = getStore();
  if (!repo || !isChatFile(fileName)) return null;
  const conversation = repo.findByFile(slug, fileName);
  return conversation ? describe(repo, conversation) : null;
}

/**
 * Records the engine session the browser just received for a saved conversation (creating the link on first use).
 * @param {string} slug @param {string} fileName @param {string} engine @param {string} sessionId
 */
function setSessionForFile(slug, fileName, engine, sessionId) {
  const repo = getStore();
  if (!repo || !isChatFile(fileName) || !isEngine(engine) || !isSessionId(sessionId)) return null;
  const conversation = repo.ensureForFile(slug, fileName);
  repo.setEngineSession(conversation.id, engine, sessionId);
  return describe(repo, /** @type {any} */ (repo.getConversation(conversation.id)));
}

/**
 * One-time import of the browser's localStorage session map (RF5): fills only engines the server does not know.
 * @param {string} slug @param {Record<string, Record<string, string|null>>} byFile
 * @returns {number} sessions imported
 */
function importLocalSessions(slug, byFile) {
  const repo = getStore();
  if (!repo || !byFile || typeof byFile !== "object") return 0;
  let imported = 0;
  for (const [fileName, sessions] of Object.entries(byFile)) {
    if (!isChatFile(fileName) || !sessions || typeof sessions !== "object") continue;
    const conversation = repo.ensureForFile(slug, fileName);
    const known = new Set(repo.getEngineSessions(conversation.id).map((s) => s.engine));
    for (const [engine, sessionId] of Object.entries(sessions)) {
      if (known.has(engine) || !isEngine(engine) || !isSessionId(sessionId)) continue;
      repo.setEngineSession(conversation.id, engine, String(sessionId));
      imported += 1;
    }
  }
  return imported;
}

module.exports = { getStore, setStore, enabled, describe, recordSave, conversationForFile, setSessionForFile, importLocalSessions, isChatFile, isEngine, isSessionId, clean };

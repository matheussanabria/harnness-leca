// @ts-check
// Sessões dos motores isoladas por projeto e conversa.
import { cs } from "./chat-store.js";

const ENGINE_IDS = ["claude", "opencode", "gemini", "codex", "ollama"];
const sessionsByChat = new Map();

function emptySessions() {
  return Object.fromEntries(ENGINE_IDS.map((engine) => [engine, null]));
}

export function chatSessionKey(slug, chatId) {
  return `${String(slug || "global").toLowerCase()}::${chatId || "draft"}`;
}

export function engineSessionsFor(slug, chatId) {
  const key = chatSessionKey(slug, chatId);
  if (!sessionsByChat.has(key)) sessionsByChat.set(key, emptySessions());
  return sessionsByChat.get(key);
}

export function activateEngineSessions(slug, chatId) {
  const sessions = engineSessionsFor(slug, chatId);
  cs.engineSessions = sessions;
  return sessions;
}

export function getEngineSession(slug, chatId, engine) {
  return engineSessionsFor(slug, chatId)[engine] || null;
}

export function setEngineSession(slug, chatId, engine, sessionId) {
  const sessions = activateEngineSessions(slug, chatId);
  sessions[engine] = sessionId || null;
  return sessions[engine];
}

export function clearEngineSessions(slug, chatId) {
  const sessions = emptySessions();
  sessionsByChat.set(chatSessionKey(slug, chatId), sessions);
  cs.engineSessions = sessions;
  return sessions;
}

export function moveEngineSessions(slug, fromChatId, toChatId) {
  const fromKey = chatSessionKey(slug, fromChatId);
  const toKey = chatSessionKey(slug, toChatId);
  const sessions = sessionsByChat.get(fromKey) || emptySessions();
  sessionsByChat.set(toKey, sessions);
  if (fromKey !== toKey) sessionsByChat.delete(fromKey);
  cs.engineSessions = sessions;
  return sessions;
}

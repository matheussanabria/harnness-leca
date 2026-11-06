// @ts-check
// Sessões dos motores isoladas por projeto e conversa.
// A tabela vive em memória, mas é espelhada no localStorage: sem isso o F5 esquecia o id da sessão do motor, o servidor
// abria uma sessão nova (sem a conversa anterior) e o modelo recomeçava do zero, até sobrescrevendo o que já tinha feito.
import { state } from "../shared/state.js";
import { cs } from "./chat-store.js";

const ENGINE_IDS = ["claude", "opencode", "gemini", "codex", "ollama"];
const STORAGE_KEY = "harness:engine-sessions:v1";
const MAX_CHATS = 60; // conversas guardadas; as mais antigas saem primeiro

/** @type {Map<string, Record<string, string | null>>} */
const sessionsByChat = new Map();
let hydrated = false;
/** Chats this tab changed since it last wrote: only these overwrite what another tab stored. */
const dirty = new Set();

function emptySessions() {
  return Object.fromEntries(ENGINE_IDS.map((engine) => [engine, null]));
}

/** Lê o que o recarregamento anterior deixou. Qualquer falha (sem storage, JSON ruim) só significa começar vazio. */
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== "object") return;
    for (const [key, value] of Object.entries(saved)) {
      if (value && typeof value === "object") sessionsByChat.set(key, { ...emptySessions(), ...value });
    }
  } catch {
    /* storage indisponível ou corrompido: segue sem sessões salvas */
  }
}

function readStored() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    // Another tab may have written since we hydrated: start from what is stored, and apply only our own changes.
    const out = readStored();
    for (const key of dirty) {
      const sessions = sessionsByChat.get(key);
      if (sessions && Object.values(sessions).some(Boolean)) out[key] = sessions;
      else delete out[key];
    }
    dirty.clear();
    const keys = Object.keys(out);
    while (keys.length > MAX_CHATS) delete out[/** @type {string} */ (keys.shift())];
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* sem espaço ou storage bloqueado: a sessão continua valendo até o próximo F5 */
  }
}

export function chatSessionKey(slug, chatId) {
  // Unsaved chats of different scopes (design views) must not share engine sessions.
  const scope = chatId || !state.chatScope ? "" : `:${state.chatScope}`;
  return `${String(slug || "global").toLowerCase()}::${chatId || "draft"}${scope}`;
}

export function engineSessionsFor(slug, chatId) {
  hydrate();
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
  dirty.add(chatSessionKey(slug, chatId));
  persist();
  return sessions[engine];
}

export function clearEngineSessions(slug, chatId) {
  hydrate();
  const sessions = emptySessions();
  sessionsByChat.set(chatSessionKey(slug, chatId), sessions);
  dirty.add(chatSessionKey(slug, chatId));
  cs.engineSessions = sessions;
  persist();
  return sessions;
}

export function moveEngineSessions(slug, fromChatId, toChatId) {
  hydrate();
  const fromKey = chatSessionKey(slug, fromChatId);
  const toKey = chatSessionKey(slug, toChatId);
  const sessions = sessionsByChat.get(fromKey) || emptySessions();
  sessionsByChat.set(toKey, sessions);
  if (fromKey !== toKey) sessionsByChat.delete(fromKey);
  dirty.add(fromKey).add(toKey);
  cs.engineSessions = sessions;
  persist();
  return sessions;
}

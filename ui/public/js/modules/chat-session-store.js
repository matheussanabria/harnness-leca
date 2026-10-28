// @ts-check
// Sessões dos motores isoladas por projeto e conversa.
// A tabela vive em memória, mas é espelhada no localStorage: sem isso o F5 esquecia o id da sessão do motor, o servidor
// abria uma sessão nova (sem a conversa anterior) e o modelo recomeçava do zero, até sobrescrevendo o que já tinha feito.
import { cs } from "./chat-store.js";

const ENGINE_IDS = ["claude", "opencode", "gemini", "codex", "ollama"];
const STORAGE_KEY = "harness:engine-sessions:v1";
const MAX_CHATS = 60; // conversas guardadas; as mais antigas saem primeiro

/** @type {Map<string, Record<string, string | null>>} */
const sessionsByChat = new Map();
let hydrated = false;

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

function persist() {
  try {
    while (sessionsByChat.size > MAX_CHATS) sessionsByChat.delete(/** @type {string} */ (sessionsByChat.keys().next().value));
    // Só guarda conversas que de fato têm alguma sessão; as vazias não valem o espaço.
    const out = {};
    for (const [key, sessions] of sessionsByChat) {
      if (Object.values(sessions).some(Boolean)) out[key] = sessions;
    }
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* sem espaço ou storage bloqueado: a sessão continua valendo até o próximo F5 */
  }
}

export function chatSessionKey(slug, chatId) {
  return `${String(slug || "global").toLowerCase()}::${chatId || "draft"}`;
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
  persist();
  return sessions[engine];
}

export function clearEngineSessions(slug, chatId) {
  hydrate();
  const sessions = emptySessions();
  sessionsByChat.set(chatSessionKey(slug, chatId), sessions);
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
  cs.engineSessions = sessions;
  persist();
  return sessions;
}

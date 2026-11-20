// @ts-check
// Network side of the chat conversations store (EP-17.02). Every call fails soft: null or false when the server
// store is off (HARNESS_CHAT_STORE=file answers 503) or unreachable, so the chat keeps working from its cache.

const BASE = "/api/chat/conversations";

/** @param {string} url @param {RequestInit} [init] @returns {Promise<any|null>} */
async function call(url, init) {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const json = (/** @type {string} */ method, /** @type {unknown} */ body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * The conversation linked to a saved chat file, with its engine sessions ({ engine: sessionId }).
 * @param {string} project @param {string} file
 * @returns {Promise<{ id: string, title: string|null, sessions: Record<string, string>, updatedAt: string } | null>}
 */
export function fetchConversationByFile(project, file) {
  return call(`${BASE}?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`);
}

/** Conversations of a project, newest activity first. @param {string} project @returns {Promise<any[]|null>} */
export async function listConversations(project) {
  const data = await call(`${BASE}?project=${encodeURIComponent(project)}`);
  return data && Array.isArray(data.conversations) ? data.conversations : null;
}

/** Records the engine session a saved chat just received. @param {string} project @param {string} file @param {string} engine @param {string} sessionId */
export async function putEngineSession(project, file, engine, sessionId) {
  return Boolean(await call(`${BASE}/sessions`, json("POST", { project, file, engine, sessionId })));
}

/** One-time import of this browser's session map. @param {string} project @param {Record<string, Record<string, string|null>>} byFile */
export async function importLocalSessions(project, byFile) {
  const data = await call(`${BASE}/import-sessions`, json("POST", { project, byFile }));
  return data ? Number(data.imported) || 0 : null;
}

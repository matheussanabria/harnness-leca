// @ts-check
// Chat per project and per scope (general chat, each design view). Switching either one parks the conversation on
// screen in localStorage and restores the one that belongs to the new target, instead of keeping the old turns.
import { state, saveActiveChatState, restoreActiveChatState, getActiveChatStorageKey } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { activateEngineSessions } from "./chat-session-store.js";
import { chatPresence } from "./chat-tabs.js";
import { isChatStreamingFor, subscribeAllChatExecutions } from "./chat-execution-store.js";

/** Saves the conversation on screen under the current project and scope, then empties the in-memory chat. */
export function parkActiveChat() {
  state.currentChatTitle = cs.currentChatTitle;
  saveActiveChatState();
  state.chatTurns = [];
  state.currentChatFile = null;
  state.currentChatTitle = null;
  state.chatSessionOrigin = null;
  cs.currentChatFile = null;
  cs.currentChatTitle = null;
}

/** Tells the other tabs which chat this one holds, so they can warn when it is the same one. */
function announceChat(slug) {
  void import("../shared/dom.js")
    .then(({ showToast }) => chatPresence((message) => showToast(message, 6000)).claim(getActiveChatStorageKey(slug)))
    .catch(() => {});
}

/** Restores the stored conversation of `slug` in the current scope (or an empty chat) and redraws every presentation. */
export function adoptStoredChat(slug) {
  const restored = restoreActiveChatState(slug);
  cs.currentChatFile = restored ? state.currentChatFile : null;
  cs.currentChatTitle = restored ? state.currentChatTitle : null;
  activateEngineSessions(slug, cs.currentChatFile);
  announceChat(slug);
  if (!restored) void restoreLastSavedChat(slug);
  if (typeof document === "undefined") return;
  for (const id of ["btnSaveChat", "btnSaveStudioChat"]) {
    const button = /** @type {HTMLButtonElement | null} */ (document.getElementById(id));
    if (button) button.disabled = state.chatTurns.length < 2;
  }
  // Loaded on demand: the render and stream modules pull in the whole chat UI, which project loading must not need.
  void Promise.all([import("./chat-render.js"), import("./chat-stream-ui.js")])
    .then(([render, stream]) => {
      render.renderChatHistory();
      stream.setStreamingUI(false);
    })
    .catch(() => {});
}

/** Newest saved chat of a project (file names start with the date). @param {{ chats?: Array<{ name: string }> } | null} project */
export function latestSavedChat(project) {
  const names = (project?.chats || []).map((chat) => chat.name).filter((name) => typeof name === "string" && name);
  return names.sort().at(-1) || null;
}

/**
 * Nothing stored in this browser for the general chat: bring back the project's newest saved chat, quietly, so the
 * conversation can simply be continued. Design scopes start empty. @param {string} slug
 */
async function restoreLastSavedChat(slug) {
  if (state.chatScope !== "") return;
  const name = latestSavedChat(state.P);
  if (!name) return;
  const { resumeExistingChat } = await import("./chat-persist.js");
  // The user may have switched project or typed in the meantime: only fill an empty chat of the same project.
  if (state.P?.slug !== slug || state.chatScope !== "" || state.chatTurns.length > 0) return;
  await resumeExistingChat(name, false, { silent: true });
}

/** True while the conversation on screen is receiving an answer: it must not be swapped out underneath the stream. */
export function isActiveChatStreaming() {
  return Boolean(state.P && isChatStreamingFor(state.P.slug, cs.currentChatFile));
}

/** @type {string | null} */
let pendingScope = null;
/** @type {(() => void) | null} */
let stopWaiting = null;

/** Applies the last requested scope as soon as the running answer ends. */
function applyWhenIdle() {
  if (stopWaiting) return;
  stopWaiting = subscribeAllChatExecutions(() => {
    if (isActiveChatStreaming()) return;
    stopWaiting?.();
    stopWaiting = null;
    const next = pendingScope;
    pendingScope = null;
    if (next !== null) switchChatScope(next);
  });
}

/**
 * Moves the chat to another scope of the same project; a no-op when the scope does not change. While an answer is
 * streaming the switch waits for it to end, so the answer lands in the chat that asked for it.
 * @param {string} scope
 */
export function switchChatScope(scope) {
  const next = scope || "";
  if (isActiveChatStreaming()) {
    pendingScope = next;
    applyWhenIdle();
    void import("../shared/dom.js").then(({ showToast }) => showToast("O chat muda quando a resposta terminar.", 4000)).catch(() => {});
    return false;
  }
  pendingScope = null;
  if (next === state.chatScope) return false;
  if (state.P) parkActiveChat();
  state.chatScope = next;
  if (state.P) adoptStoredChat(state.P.slug);
  return true;
}

/** Scope of one artifact inside a design view (a mind map, a prototype): two artifacts never share a chat. */
export function setChatArtifact(view, artifactId) {
  return switchChatScope(`design:${view}${artifactId ? `:${artifactId}` : ""}`);
}

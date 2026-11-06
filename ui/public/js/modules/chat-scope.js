// @ts-check
// Chat per project and per scope (general chat, each design view). Switching either one parks the conversation on
// screen in localStorage and restores the one that belongs to the new target, instead of keeping the old turns.
import { state, saveActiveChatState, restoreActiveChatState } from "../shared/state.js";
import { cs } from "./chat-store.js";
import { activateEngineSessions } from "./chat-session-store.js";

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

/** Restores the stored conversation of `slug` in the current scope (or an empty chat) and redraws every presentation. */
export function adoptStoredChat(slug) {
  const restored = restoreActiveChatState(slug);
  cs.currentChatFile = restored ? state.currentChatFile : null;
  cs.currentChatTitle = restored ? state.currentChatTitle : null;
  activateEngineSessions(slug, cs.currentChatFile);
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

/** Moves the chat to another scope of the same project; a no-op when the scope does not change. @param {string} scope */
export function switchChatScope(scope) {
  const next = scope || "";
  if (next === state.chatScope) return false;
  if (state.P) parkActiveChat();
  state.chatScope = next;
  if (state.P) adoptStoredChat(state.P.slug);
  return true;
}

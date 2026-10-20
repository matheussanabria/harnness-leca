// @ts-check
// Abertura do chat, teclado, status e interface de streaming.
import { $ } from "../shared/dom.js";
import { state, saveActiveChatState, restoreActiveChatState } from "../shared/state.js";
import { restoreMobileChatDraft, updateClaudeBottomPills } from "./mobile-chat.js";
import { cs } from "./chat-store.js";
import { updateMiniChatWidget, hideMiniChatWidget } from "./chat-mini.js";
import { updateEngineAuthBadge, switchEngine } from "./chat-engines.js";
import { renderChatHistory } from "./chat-render.js";
import {
  cancelChatExecution,
  isChatStreamingFor,
  setChatStreaming,
  setChatExecutionStatus,
  getChatExecutionStatus,
} from "./chat-execution-store.js";

let chatStreamTimer = null;

function activeChatIsStreaming() {
  return Boolean(state.P && isChatStreamingFor(state.P.slug, cs.currentChatFile));
}

export function openInteractiveChat() {
  const P = state.P;
  if (!P) return;
  const titleEl = $("chatTitle");
  if (titleEl) titleEl.textContent = `Chat · ${P.slug}`;
  if (!state.chatTurns.length) {
    restoreActiveChatState(P.slug);
  }
  if (cs.currentEngine === "compare") {
    switchEngine("compare");
  } else {
    updateEngineAuthBadge();
  }
  if (typeof restoreMobileChatDraft === "function") {
    restoreMobileChatDraft(P.slug);
  }
  if (typeof updateClaudeBottomPills === "function") {
    updateClaudeBottomPills();
  }
  hideMiniChatWidget();
  /** @type {any} */ ($("chatDlg")).showModal();
  renderChatHistory();
  setTimeout(() => {
    const inp = $("chatInput");
    if (inp) inp.focus();
    const hist = $("chatHistory");
    if (hist) hist.scrollTop = hist.scrollHeight;
  }, 50);
}

export function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

export function setChatStatus(text, statusType = null) {
  const s1 = $("chatStatusText");
  if (s1) s1.textContent = text;
  const s2 = $("studioChatStatusText");
  if (s2) s2.textContent = text;
  const s3 = $("miniChatStatusText");
  if (s3) s3.textContent = text;

  if (statusType && state.P) {
    setChatExecutionStatus(state.P.slug, cs.currentChatFile, statusType, text);
  }
}

export function setStreamingUI(streaming) {
  if (state.P) {
    setChatStreaming(state.P.slug, cs.currentChatFile, streaming, cs.currentEngine);
  }
  const sendBtn = $("btnSendChat");
  const cancelBtn = $("btnCancelChat");
  const saveBtn = /** @type {HTMLButtonElement} */ ($("btnSaveChat"));
  if (sendBtn) sendBtn.style.display = streaming ? "none" : "inline-flex";
  if (cancelBtn) cancelBtn.style.display = streaming ? "inline-flex" : "none";
  if (saveBtn) saveBtn.disabled = streaming || state.chatTurns.length < 2;

  const sendStudioBtn = $("btnSendStudioChat");
  const cancelStudioBtn = $("btnCancelStudioChat");
  const saveStudioBtn = /** @type {HTMLButtonElement} */ ($("btnSaveStudioChat"));
  if (sendStudioBtn) sendStudioBtn.style.display = streaming ? "none" : "inline-flex";
  if (cancelStudioBtn) cancelStudioBtn.style.display = streaming ? "inline-flex" : "none";
  if (saveStudioBtn) saveStudioBtn.disabled = streaming || state.chatTurns.length < 2;

  const sendMiniBtn = $("btnSendMiniChat");
  const cancelMiniBtn = $("btnCancelMiniChat");
  if (sendMiniBtn) sendMiniBtn.style.display = streaming ? "none" : "inline-flex";
  if (cancelMiniBtn) cancelMiniBtn.style.display = streaming ? "inline-flex" : "none";

  updateMiniChatWidget();
  if (!streaming) {
    saveActiveChatState();
  }

  if (streaming) {
    if (!chatStreamTimer) {
      chatStreamTimer = setInterval(() => {
        if (!activeChatIsStreaming()) {
          clearInterval(chatStreamTimer);
          chatStreamTimer = null;
          return;
        }
        renderChatHistory(true);
      }, 500);
    }
  } else {
    if (chatStreamTimer) {
      clearInterval(chatStreamTimer);
      chatStreamTimer = null;
    }
  }
}

export function cancelEngineStream(eng) {
  const P = state.P;
  if (P) cancelChatExecution(P.slug, cs.currentChatFile, eng);
}

export function cancelChatStream() {
  const P = state.P;
  if (P) cancelChatExecution(P.slug, cs.currentChatFile);
  setStreamingUI(false);
  setChatStatus("Geração interrompida pelo usuário", "cancelled");
}

// @ts-check
// Execuções, estados e cancelamentos isolados por projeto e conversa.
import { chatSessionKey } from "./chat-session-store.js";

/**
 * @typedef {'idle' | 'streaming' | 'waiting_approval' | 'cancelled' | 'error'} ChatExecutionStatus
 */

const executionByChat = new Map();
const listenersByChat = new Map();
const globalListeners = new Set();

function emptyExecution() {
  return {
    status: /** @type {ChatExecutionStatus} */ ("idle"),
    streaming: false,
    currentEngine: null,
    errorMessage: "",
    startedAt: 0,
    controllers: new Map(),
  };
}

export function chatExecutionFor(slug, chatId) {
  const key = chatSessionKey(slug, chatId);
  if (!executionByChat.has(key)) executionByChat.set(key, emptyExecution());
  return executionByChat.get(key);
}

export function getChatExecutionStatus(slug, chatId) {
  return chatExecutionFor(slug, chatId).status;
}

export function isChatStreamingFor(slug, chatId) {
  return chatExecutionFor(slug, chatId).streaming;
}

function notifyExecution(slug, chatId) {
  const key = chatSessionKey(slug, chatId);
  const state = executionByChat.get(key);
  if (!state) return;
  const subs = listenersByChat.get(key);
  const snapshot = {
    status: state.status,
    streaming: state.streaming,
    currentEngine: state.currentEngine,
    errorMessage: state.errorMessage,
    startedAt: state.startedAt,
    controllersCount: state.controllers.size,
  };
  if (subs) {
    subs.forEach((cb) => {
      try { cb(snapshot); } catch {}
    });
  }
  globalListeners.forEach((cb) => {
    try { cb({ slug, chatId, ...snapshot }); } catch {}
  });
}

export function subscribeAllChatExecutions(callback) {
  globalListeners.add(callback);
  return () => {
    globalListeners.delete(callback);
  };
}

export function subscribeChatExecution(slug, chatId, callback) {
  const key = chatSessionKey(slug, chatId);
  if (!listenersByChat.has(key)) listenersByChat.set(key, new Set());
  const set = listenersByChat.get(key);
  set.add(callback);
  return () => {
    set.delete(callback);
    if (set.size === 0) listenersByChat.delete(key);
  };
}

export function setChatStreaming(slug, chatId, streaming, engine = null) {
  const execution = chatExecutionFor(slug, chatId);
  execution.streaming = Boolean(streaming);
  execution.status = streaming ? "streaming" : (execution.status === "streaming" ? "idle" : execution.status);
  if (streaming) {
    execution.currentEngine = engine;
    execution.startedAt = Date.now();
    execution.errorMessage = "";
  }
  notifyExecution(slug, chatId);
}

export function setChatExecutionStatus(slug, chatId, status, error = "") {
  const execution = chatExecutionFor(slug, chatId);
  execution.status = status;
  execution.streaming = status === "streaming";
  execution.errorMessage = error || "";
  if (!execution.streaming) {
    execution.controllers.clear();
  }
  notifyExecution(slug, chatId);
}

export function setChatAbortController(slug, chatId, engine, controller) {
  const execution = chatExecutionFor(slug, chatId);
  if (controller) {
    execution.controllers.set(engine, controller);
  } else {
    execution.controllers.delete(engine);
  }
  notifyExecution(slug, chatId);
}

export function cancelChatExecution(slug, chatId, engine) {
  const execution = chatExecutionFor(slug, chatId);
  const targets = engine ? [[engine, execution.controllers.get(engine)]] : [...execution.controllers.entries()];
  targets.forEach(([engineId, controller]) => {
    if (controller) {
      try { controller.abort(); } catch {}
    }
    execution.controllers.delete(engineId);
  });
  if (!engine || execution.controllers.size === 0) {
    execution.streaming = false;
    execution.status = "cancelled";
  }
  notifyExecution(slug, chatId);
}

export function resetChatExecution(slug, chatId) {
  const key = chatSessionKey(slug, chatId);
  executionByChat.delete(key);
  notifyExecution(slug, chatId);
}

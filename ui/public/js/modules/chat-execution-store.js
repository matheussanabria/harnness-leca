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

function notifyExecution(slug, chatId, finalState = null) {
  const key = chatSessionKey(slug, chatId);
  const state = finalState || executionByChat.get(key);
  if (!state) return;
  const subs = listenersByChat.get(key);
  const snapshot = {
    status: state.status,
    streaming: state.streaming,
    currentEngine: state.currentEngine,
    errorMessage: state.errorMessage,
    startedAt: state.startedAt,
    controllersCount: state.controllers.size,
    controllerEngines: [...state.controllers.keys()],
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

function isWorking(execution) {
  return execution.streaming || execution.status === "waiting_approval";
}

/**
 * Engines a chat is running on: its currentEngine plus every engine holding an abort
 * controller (compare mode registers one controller per compared engine).
 */
function enginesOf(execution) {
  const engines = new Set(execution.controllers.keys());
  if (execution.currentEngine) engines.add(execution.currentEngine);
  return engines;
}

/**
 * Counts, across all projects and chats of this document, the chats working for an engine.
 * Browser-local: it does not see chats running in other tabs.
 * @param {string} engine
 * @returns {{ count: number, waitingApproval: number }}
 */
export function countActiveByEngine(engine) {
  let count = 0;
  let waitingApproval = 0;
  executionByChat.forEach((execution) => {
    if (!isWorking(execution) || !enginesOf(execution).has(engine)) return;
    count += 1;
    if (execution.status === "waiting_approval") waitingApproval += 1;
  });
  return { count, waitingApproval };
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
  const previous = executionByChat.get(key);
  executionByChat.delete(key);
  if (!previous) return;
  // Tell listeners the chat is gone, keeping the engine so aggregators can recompute it.
  notifyExecution(slug, chatId, { ...previous, status: "idle", streaming: false, errorMessage: "" });
}

// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  chatExecutionFor,
  getChatExecutionStatus,
  isChatStreamingFor,
  subscribeChatExecution,
  setChatStreaming,
  setChatExecutionStatus,
  setChatAbortController,
  cancelChatExecution,
  resetChatExecution,
} from "../ui/public/js/modules/chat-execution-store.js";

test("EP-02.08: Isolamento e inicialização canônica de execuções", () => {
  const slug = "proj-test-exec";
  const chat1 = "chat-1.json";
  const chat2 = "chat-2.json";

  resetChatExecution(slug, chat1);
  resetChatExecution(slug, chat2);

  const exec1 = chatExecutionFor(slug, chat1);
  assert.equal(exec1.status, "idle");
  assert.equal(exec1.streaming, false);
  assert.equal(exec1.controllers.size, 0);

  const exec2 = chatExecutionFor(slug, chat2);
  assert.notEqual(exec1, exec2);
  assert.equal(getChatExecutionStatus(slug, chat1), "idle");
  assert.equal(isChatStreamingFor(slug, chat1), false);
});

test("EP-02.08: Transição de streaming, motores e registro de tempo", () => {
  const slug = "proj-test-stream";
  const chat = "chat-stream.json";
  resetChatExecution(slug, chat);

  let notifiedSnapshot = null;
  const unsubscribe = subscribeChatExecution(slug, chat, (snap) => {
    notifiedSnapshot = snap;
  });

  setChatStreaming(slug, chat, true, "claude");
  assert.equal(isChatStreamingFor(slug, chat), true);
  assert.equal(getChatExecutionStatus(slug, chat), "streaming");
  assert.ok(notifiedSnapshot);
  assert.equal(notifiedSnapshot.status, "streaming");
  assert.equal(notifiedSnapshot.currentEngine, "claude");
  assert.ok(notifiedSnapshot.startedAt > 0);

  setChatStreaming(slug, chat, false);
  assert.equal(isChatStreamingFor(slug, chat), false);
  assert.equal(getChatExecutionStatus(slug, chat), "idle");
  assert.equal(notifiedSnapshot.status, "idle");

  unsubscribe();
});

test("EP-02.08: Cancelamento granular por motor e global com AbortController", () => {
  const slug = "proj-test-cancel";
  const chat = "chat-cancel.json";
  resetChatExecution(slug, chat);

  let abortedClaude = false;
  let abortedGemini = false;

  const mockControllerClaude = { abort: () => { abortedClaude = true; } };
  const mockControllerGemini = { abort: () => { abortedGemini = true; } };

  setChatStreaming(slug, chat, true, "compare");
  setChatAbortController(slug, chat, "claude", mockControllerClaude);
  setChatAbortController(slug, chat, "gemini", mockControllerGemini);

  const exec = chatExecutionFor(slug, chat);
  assert.equal(exec.controllers.size, 2);

  // Cancelamento granular apenas de Claude
  cancelChatExecution(slug, chat, "claude");
  assert.equal(abortedClaude, true);
  assert.equal(abortedGemini, false);
  assert.equal(exec.controllers.size, 1);
  assert.equal(isChatStreamingFor(slug, chat), true);

  // Cancelamento global restante
  cancelChatExecution(slug, chat);
  assert.equal(abortedGemini, true);
  assert.equal(exec.controllers.size, 0);
  assert.equal(isChatStreamingFor(slug, chat), false);
  assert.equal(getChatExecutionStatus(slug, chat), "cancelled");
});

test("EP-02.08: Estados especiais de aprovação e erro com notificação", () => {
  const slug = "proj-test-approval";
  const chat = "chat-approval.json";
  resetChatExecution(slug, chat);

  const snapshots = [];
  const unsubscribe = subscribeChatExecution(slug, chat, (snap) => {
    snapshots.push(snap);
  });

  // Transição para waiting_approval (ex: permissão do Claude Code / Gemini)
  setChatExecutionStatus(slug, chat, "waiting_approval", "Aguardando confirmação de ferramenta");
  assert.equal(getChatExecutionStatus(slug, chat), "waiting_approval");

  // Transição para error
  setChatExecutionStatus(slug, chat, "error", "Falha de conexão com o motor");
  assert.equal(getChatExecutionStatus(slug, chat), "error");
  const last = snapshots[snapshots.length - 1];
  assert.equal(last.status, "error");
  assert.equal(last.errorMessage, "Falha de conexão com o motor");

  unsubscribe();
});

test("EP-02.08: Unsubscribe limpa observadores sem vazamento de memória", () => {
  const slug = "proj-test-leak";
  const chat = "chat-leak.json";
  resetChatExecution(slug, chat);

  let count = 0;
  const unsubscribe = subscribeChatExecution(slug, chat, () => { count++; });

  setChatStreaming(slug, chat, true);
  assert.equal(count, 1);

  unsubscribe();
  setChatStreaming(slug, chat, false);
  assert.equal(count, 1, "Não deve receber notificações após unsubscribe");
});

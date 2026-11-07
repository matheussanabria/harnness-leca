// @ts-check
// A conversa em andamento é isolada por projeto e por escopo (chat geral, cada aba do Design).
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
});

const { state, getActiveChatStorageKey, saveActiveChatState, restoreActiveChatState } = await import("../ui/public/js/shared/state.js");
const sessions = await import("../ui/public/js/modules/chat-session-store.js");

test.beforeEach(() => {
  store.clear();
  state.chatTurns = [];
  state.chatScope = "";
  state.currentChatFile = null;
});

test("a chave do escopo geral continua a antiga; escopos de design ganham sufixo", () => {
  assert.equal(getActiveChatStorageKey("inv", ""), "harness_active_chat_inv");
  assert.equal(getActiveChatStorageKey("inv", "design:canvas-mindmap"), "harness_active_chat_inv::design:canvas-mindmap");
});

test("cada projeto e cada escopo guardam e devolvem a propria conversa", () => {
  state.P = /** @type {any} */ ({ slug: "a" });
  state.chatTurns = [{ role: "user", text: "chat geral de a" }];
  saveActiveChatState();
  state.chatScope = "design:canvas-mindmap";
  state.chatTurns = [{ role: "user", text: "mapa de a" }];
  state.currentChatFile = "mapa.md";
  saveActiveChatState();

  state.chatTurns = [];
  state.currentChatFile = null;
  assert.equal(restoreActiveChatState("a")?.chatTurns[0].text, "mapa de a");
  assert.equal(state.currentChatFile, "mapa.md");

  state.chatScope = "";
  assert.equal(restoreActiveChatState("a")?.chatTurns[0].text, "chat geral de a");
  assert.equal(restoreActiveChatState("b"), null, "outro projeto nao herda a conversa");
});

test("rascunhos de escopos diferentes nao compartilham a sessao do motor", () => {
  state.chatScope = "design:prototypes";
  sessions.setEngineSession("a", null, "claude", "ses_atelie");
  state.chatScope = "design:canvas-mindmap";
  assert.equal(sessions.getEngineSession("a", null, "claude"), null);
  state.chatScope = "design:prototypes";
  assert.equal(sessions.getEngineSession("a", null, "claude"), "ses_atelie");
});

test("o ultimo chat salvo do projeto e o de nome (data) mais recente", async () => {
  const { latestSavedChat } = await import("../ui/public/js/modules/chat-scope.js");
  assert.equal(latestSavedChat(null), null);
  assert.equal(latestSavedChat({ chats: [] }), null);
  assert.equal(
    latestSavedChat({ chats: [{ name: "2026-10-01-a.md" }, { name: "2026-11-05-c.md" }, { name: "2026-11-02-b.md" }] }),
    "2026-11-05-c.md",
  );
});

test("enquanto uma resposta chega, a troca de escopo espera e nao mexe no chat", async () => {
  const exec = await import("../ui/public/js/modules/chat-execution-store.js");
  const { switchChatScope } = await import("../ui/public/js/modules/chat-scope.js");
  state.P = /** @type {any} */ ({ slug: "a" });
  state.chatScope = "";
  state.chatTurns = [{ role: "user", text: "pergunta" }];
  exec.setChatStreaming("a", null, true, "claude");
  assert.equal(switchChatScope("design:board"), false);
  assert.equal(state.chatScope, "", "o escopo nao muda no meio do streaming");
  assert.equal(state.chatTurns.length, 1, "a conversa em andamento fica no lugar");
  exec.setChatStreaming("a", null, false, "claude");
  assert.equal(state.chatScope, "design:board", "a troca pendente e aplicada quando a resposta termina");
});

// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] || null,
    get length() {
      return store.size;
    },
  };
}

if (!globalThis.window) {
  globalThis.window = /** @type {any} */ ({
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: globalThis.localStorage,
  });
}

let containerMock = { innerHTML: "" };
let searchValMock = "";

if (!globalThis.document) {
  globalThis.document = /** @type {any} */ ({
    getElementById: (id) => {
      if (id === "continueChatList") return containerMock;
      if (id === "continueChatSearch") return { value: searchValMock, focus: () => {} };
      if (id === "continueChatTitle") return { textContent: "" };
      if (id === "continueChatDlg") return { showModal: () => {}, close: () => {} };
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

test("EP-02.06: chat-session-store isola sessões por projeto, conversa e os 4 motores", async () => {
  const {
    chatSessionKey,
    getEngineSession,
    setEngineSession,
    moveEngineSessions,
    clearEngineSessions,
  } = await import("../ui/public/js/modules/chat-session-store.js");

  const slug = "saude-dispensacao";
  const draftId = null;
  const savedFile = "2026-10-19-analise-fluxo.md";

  assert.equal(chatSessionKey(slug, draftId), "saude-dispensacao::draft");
  assert.equal(chatSessionKey(slug, savedFile), "saude-dispensacao::2026-10-19-analise-fluxo.md");

  // Sessões em rascunho para os motores canônicos
  setEngineSession(slug, draftId, "claude", "sess-claude-123");
  setEngineSession(slug, draftId, "gemini", "sess-gemini-456");
  setEngineSession(slug, draftId, "opencode", "sess-open-789");
  setEngineSession(slug, draftId, "codex", "sess-codex-abc");
  setEngineSession(slug, draftId, "ollama", "sess-ollama-def");

  assert.equal(getEngineSession(slug, draftId, "claude"), "sess-claude-123");
  assert.equal(getEngineSession(slug, draftId, "gemini"), "sess-gemini-456");
  assert.equal(getEngineSession(slug, draftId, "opencode"), "sess-open-789");
  assert.equal(getEngineSession(slug, draftId, "codex"), "sess-codex-abc");
  assert.equal(getEngineSession(slug, draftId, "ollama"), "sess-ollama-def");

  // Outro projeto não enxerga as mesmas sessões
  assert.equal(getEngineSession("outro-projeto", draftId, "claude"), null);

  // Migração atômica de sessões ao salvar o rascunho com nome definitivo
  moveEngineSessions(slug, draftId, savedFile);

  assert.equal(getEngineSession(slug, savedFile, "claude"), "sess-claude-123");
  assert.equal(getEngineSession(slug, savedFile, "gemini"), "sess-gemini-456");
  assert.equal(getEngineSession(slug, savedFile, "opencode"), "sess-open-789");
  assert.equal(getEngineSession(slug, savedFile, "codex"), "sess-codex-abc");
  assert.equal(getEngineSession(slug, savedFile, "ollama"), "sess-ollama-def");

  // Chave antiga draft foi liberada
  assert.equal(getEngineSession(slug, draftId, "claude"), null);

  // Limpeza de sessão
  clearEngineSessions(slug, savedFile);
  assert.equal(getEngineSession(slug, savedFile, "claude"), null);
});

test("EP-02.06: chat-continue suporta os motores locais e de nuvem com FontAwesome e zero emojis", async () => {
  const { state } = await import("../ui/public/js/shared/state.js");
  const { cs } = await import("../ui/public/js/modules/chat-store.js");
  const { renderContinueChatList } = await import(
    "../ui/public/js/modules/chat-continue.js"
  );

  state.P = {
    slug: "saude-dispensacao",
    chats: [
      { name: "chat-claude.md", title: "Refatoração Claude", agent: "claude", mtime: Date.now(), turns: 4 },
      { name: "chat-gemini.md", title: "Ideias Gemini", agent: "gemini", mtime: Date.now(), turns: 2 },
      { name: "chat-opencode.md", title: "Terminal OpenCode", agent: "opencode", mtime: Date.now(), turns: 5 },
      { name: "chat-codex.md", title: "Arquitetura Codex", agent: "codex", mtime: Date.now(), turns: 6 },
      { name: "chat-ollama.md", title: "Resumo Local", agent: "ollama", mtime: Date.now(), turns: 3 },
    ],
  };

  // 1. Renderizar todas
  cs.continueChatFilter = "all";
  searchValMock = "";
  renderContinueChatList();

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(containerMock.innerHTML), false, "HTML não deve conter emojis");

  assert.ok(containerMock.innerHTML.includes("fa-asterisk"), "Claude deve ter ícone FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-bolt"), "Gemini deve ter ícone FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-code"), "OpenCode deve ter ícone FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-terminal"), "Codex deve ter ícone FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-microchip"), "Ollama Local deve ter ícone FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-laptop-code"), "Botão Studio deve usar FontAwesome");
  assert.ok(containerMock.innerHTML.includes("fa-comments"), "Botão Chat deve usar FontAwesome");

  // 2. Filtrar por codex
  cs.continueChatFilter = "codex";
  renderContinueChatList();
  assert.ok(containerMock.innerHTML.includes("Arquitetura Codex"));
  assert.equal(containerMock.innerHTML.includes("Refatoração Claude"), false);

  // 3. Filtrar por busca
  cs.continueChatFilter = "all";
  searchValMock = "Ideias";
  renderContinueChatList();
  assert.ok(containerMock.innerHTML.includes("Ideias Gemini"));
  assert.equal(containerMock.innerHTML.includes("Arquitetura Codex"), false);
});

test("HIA: bloco hia-script é lido como metadado e não aparece como processamento interno", async () => {
  const { parseChat, renderChat } = await import("../ui/public/js/shared/markdown.js");
  const src = [
    "## Você",
    "",
    "resuma",
    "",
    "## Claude",
    "",
    "pronto",
    "",
    ":::tool hia-script | hia.summarize",
    "--- entrada",
    "",
    "--- resultado",
    "120",
    ":::",
    "",
  ].join("\n");

  const items = parseChat(src);
  const internal = items.find((it) => it.who === "internal");
  assert.equal(internal.tools[0].name, "hia-script");
  assert.equal(internal.tools[0].hint, "hia.summarize");
  assert.equal(internal.tools[0].result, "120");

  const html = renderChat(src);
  assert.equal(html.includes("hia-script"), false, "metadado não vira etapa interna");
  assert.equal(html.includes("Processamento interno"), false);
  assert.ok(html.includes("pronto"));
});

test("chat-format: turno do Ollama Local é reconhecido e rende como motor local", async () => {
  const { parseChat, renderChat } = await import("../ui/public/js/shared/markdown.js");
  const src = [
    "## Você",
    "",
    "classifique",
    "",
    "## Ollama",
    "",
    "classe A",
    "",
    ":::tool hia-local_llm | qwen2.5-coder:1.5b",
    "--- resultado",
    "800",
    ":::",
    "",
  ].join("\n");

  const items = parseChat(src);
  assert.equal(items.find((it) => it.text === "classe A").who, "ollama");
  const internal = items.find((it) => it.who === "internal");
  assert.equal(internal.tools[0].name, "hia-local_llm");

  const html = renderChat(src);
  assert.ok(html.includes('class="msg ollama"'), "turno local não é atribuído ao Claude");
  assert.equal(html.includes("Processamento interno"), false);
});

test("EP-02.06: Markup continueChatDlg e módulo chat-persist atendem à política de zero emojis", () => {
  const dialogsFile = path.join(rootDir, "ui/public/partials/dialogs-groups.html");
  const dialogsContent = fs.readFileSync(dialogsFile, "utf8");

  // O modal continueChatDlg começa em <dialog id="continueChatDlg"
  const continueDlgMatch = dialogsContent.match(/<dialog id="continueChatDlg"[\s\S]*?<\/dialog>/);
  assert.ok(continueDlgMatch, "Modal continueChatDlg deve estar presente");

  const dlgHtml = continueDlgMatch[0];
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(dlgHtml), false, "Modal continueChatDlg não deve conter emojis");
  assert.ok(dlgHtml.includes('data-filter="codex"'), "Modal deve ter botão de filtro para Codex");
  assert.ok(dlgHtml.includes('data-filter="ollama"'), "Modal deve ter botão de filtro para Ollama Local");
  assert.ok(dlgHtml.includes("fa-folder-open"), "Título do modal deve usar fa-folder-open");

  const persistFile = path.join(rootDir, "ui/public/js/modules/chat-persist.js");
  const persistContent = fs.readFileSync(persistFile, "utf8");
  assert.equal(emojiRegex.test(persistContent), false, "chat-persist.js não deve conter emojis");
});

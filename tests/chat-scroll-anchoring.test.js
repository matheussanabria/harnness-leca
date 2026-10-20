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

const domElements = new Map();
function mockElement(id, initial = {}) {
  const el = {
    id,
    style: { display: "none" },
    scrollHeight: 1000,
    scrollTop: 0,
    clientHeight: 400,
    scrollTo: function (opts) {
      this.scrollTop = opts.top;
    },
    innerHTML: "",
    ...initial,
  };
  domElements.set(id, el);
  return el;
}

globalThis.document = /** @type {any} */ ({
  getElementById: (id) => domElements.get(id) || null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
});

test("EP-02.07: Contratos canônicos de scrollButton nas três apresentações", async () => {
  const { chatPresentation } = await import("../ui/public/js/modules/chat-presentations.js");

  const main = chatPresentation("main");
  assert.equal(main.scrollButton, "chatScrollBottomBtn");
  assert.equal(main.history, "chatHistory");

  const studio = chatPresentation("studio");
  assert.equal(studio.scrollButton, "studioChatScrollBottomBtn");
  assert.equal(studio.history, "studioChatHistory");

  const mini = chatPresentation("mini");
  assert.equal(mini.scrollButton, "miniChatScrollBtn");
  assert.equal(mini.history, "miniChatHistory");
});

test("EP-02.07: Markup HTML dos botões de scroll nas 3 apresentações com FontAwesome e zero emojis", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  // 1. Dialogs Chat (Main)
  const mainHtml = fs.readFileSync(path.join(rootDir, "ui/public/partials/dialogs-chat.html"), "utf8");
  assert.ok(mainHtml.includes('id="chatScrollBottomBtn"'), "Deve conter chatScrollBottomBtn");
  assert.ok(mainHtml.includes("onclick=\"scrollChatToBottom()\""), "Handler de clique scrollChatToBottom");
  assert.ok(mainHtml.includes("fa-arrow-down"), "Ícone fa-arrow-down");
  const mainBtnMatch = mainHtml.match(/<button[^>]*id="chatScrollBottomBtn"[\s\S]*?<\/button>/);
  assert.ok(mainBtnMatch && !emojiRegex.test(mainBtnMatch[0]), "Botão main sem emojis");

  // 2. Studio
  const studioHtml = fs.readFileSync(path.join(rootDir, "ui/public/partials/studio.html"), "utf8");
  assert.ok(studioHtml.includes('id="studioChatScrollBottomBtn"'), "Deve conter studioChatScrollBottomBtn");
  assert.ok(studioHtml.includes("onclick=\"scrollStudioChatToBottom()\""), "Handler de clique scrollStudioChatToBottom");
  assert.ok(studioHtml.includes("fa-arrow-down"), "Ícone fa-arrow-down");
  const studioBtnMatch = studioHtml.match(/<button[^>]*id="studioChatScrollBottomBtn"[\s\S]*?<\/button>/);
  assert.ok(studioBtnMatch && !emojiRegex.test(studioBtnMatch[0]), "Botão studio sem emojis");

  // 3. Mini Dock
  const miscHtml = fs.readFileSync(path.join(rootDir, "ui/public/partials/dialogs-misc.html"), "utf8");
  assert.ok(miscHtml.includes('id="miniChatScrollBtn"'), "Deve conter miniChatScrollBtn");
  assert.ok(miscHtml.includes("onclick=\"scrollMiniChatToBottom()\""), "Handler de clique scrollMiniChatToBottom");
  assert.ok(miscHtml.includes("fa-arrow-down"), "Ícone fa-arrow-down");
  const miniBtnMatch = miscHtml.match(/<button[^>]*id="miniChatScrollBtn"[\s\S]*?<\/button>/);
  assert.ok(miniBtnMatch && !emojiRegex.test(miniBtnMatch[0]), "Botão mini sem emojis");
});

test("EP-02.07: handleChatHistoryScroll detecta proximidade do fundo e gerencia visibilidade", async () => {
  const { handleChatHistoryScroll } = await import("../ui/public/js/modules/chat-ui-interaction.js");

  // Main
  const mainHist = mockElement("chatHistory", { scrollHeight: 1000, clientHeight: 400 });
  const mainBtn = mockElement("chatScrollBottomBtn", { style: { display: "none" } });

  // 1. Perto do fim (distância: 1000 - 550 - 400 = 50 < 80) -> Oculta botão
  mainHist.scrollTop = 550;
  handleChatHistoryScroll(mainHist);
  assert.equal(mainBtn.style.display, "none");

  // 2. Longe do fim (distância: 1000 - 200 - 400 = 400 >= 80) -> Exibe botão
  mainHist.scrollTop = 200;
  handleChatHistoryScroll(mainHist);
  assert.equal(mainBtn.style.display, "flex");

  // Studio
  const studioHist = mockElement("studioChatHistory", { scrollHeight: 1200, clientHeight: 500 });
  const studioBtn = mockElement("studioChatScrollBottomBtn", { style: { display: "none" } });

  studioHist.scrollTop = 300; // distância 400 >= 80
  handleChatHistoryScroll(studioHist);
  assert.equal(studioBtn.style.display, "flex");

  studioHist.scrollTop = 680; // distância 20 < 80
  handleChatHistoryScroll(studioHist);
  assert.equal(studioBtn.style.display, "none");

  // Mini
  const miniHist = mockElement("miniChatHistory", { scrollHeight: 800, clientHeight: 300 });
  const miniBtn = mockElement("miniChatScrollBtn", { style: { display: "none" } });

  miniHist.scrollTop = 100; // distância 400 >= 80
  handleChatHistoryScroll(miniHist);
  assert.equal(miniBtn.style.display, "flex");

  miniHist.scrollTop = 480; // distância 20 < 80
  handleChatHistoryScroll(miniHist);
  assert.equal(miniBtn.style.display, "none");
});

test("EP-02.07: scrollChatToBottom e variantes rolam suavemente e ocultam o botão", async () => {
  const {
    scrollChatToBottom,
    scrollStudioChatToBottom,
    scrollMiniChatToBottom,
  } = await import("../ui/public/js/modules/chat-ui-interaction.js");

  // Main
  const mainHist = mockElement("chatHistory", { scrollHeight: 1000, scrollTop: 200 });
  const mainBtn = mockElement("chatScrollBottomBtn", { style: { display: "flex" } });

  scrollChatToBottom("main");
  assert.equal(mainHist.scrollTop, 1000);
  assert.equal(mainBtn.style.display, "none");

  // Studio
  const studioHist = mockElement("studioChatHistory", { scrollHeight: 1500, scrollTop: 300 });
  const studioBtn = mockElement("studioChatScrollBottomBtn", { style: { display: "flex" } });

  scrollStudioChatToBottom();
  assert.equal(studioHist.scrollTop, 1500);
  assert.equal(studioBtn.style.display, "none");

  // Mini
  const miniHist = mockElement("miniChatHistory", { scrollHeight: 700, scrollTop: 100 });
  const miniBtn = mockElement("miniChatScrollBtn", { style: { display: "flex" } });

  scrollMiniChatToBottom();
  assert.equal(miniHist.scrollTop, 700);
  assert.equal(miniBtn.style.display, "none");
});

test("EP-02.07: renderChatHistory respeita a âncora preservando scroll ao ler mensagens acima", async () => {
  const { state } = await import("../ui/public/js/shared/state.js");
  const { renderChatHistory } = await import("../ui/public/js/modules/chat-render.js");

  state.P = { slug: "saude-dispensacao", chats: [] };
  state.chatTurns = [
    { role: "user", text: "Olá" },
    { role: "assistant", engine: "gemini", text: "Resposta inicial" },
  ];

  // Cenário A: Usuário no rodapé (wasNearBottom = true)
  const hist = mockElement("chatHistory", {
    scrollHeight: 1000,
    clientHeight: 400,
    scrollTop: 580, // distância 20 < 80
  });
  mockElement("chatScrollBottomBtn", { style: { display: "none" } });
  mockElement("studioChatHistory", { scrollHeight: 1000, clientHeight: 400, scrollTop: 580 });
  mockElement("studioChatScrollBottomBtn", { style: { display: "none" } });
  mockElement("miniChatHistory", { scrollHeight: 1000, clientHeight: 400, scrollTop: 580 });
  mockElement("miniChatScrollBtn", { style: { display: "none" } });

  renderChatHistory(false);
  // O container deve ter sido ancorado no final
  assert.equal(hist.scrollTop, 1000);

  // Cenário B: Usuário rolou para cima (wasNearBottom = false)
  hist.scrollTop = 200; // distância 1000 - 200 - 400 = 400 >= 80
  renderChatHistory(false);
  // O container NÃO DEVE ter sido empurrado para 1000
  assert.equal(hist.scrollTop, 200);
  // O botão de descer deve estar visível
  assert.equal(domElements.get("chatScrollBottomBtn").style.display, "flex");
});

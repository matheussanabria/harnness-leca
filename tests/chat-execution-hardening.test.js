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
    disabled: false,
    textContent: "",
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

test("EP-02.08: chat-execution-store gerencia ciclo de vida atômico de streaming e abort", async () => {
  const {
    chatExecutionFor,
    isChatStreamingFor,
    setChatStreaming,
    setChatAbortController,
    cancelChatExecution,
  } = await import("../ui/public/js/modules/chat-execution-store.js");

  const slug = "saude-dispensacao";
  const chatId = "chat-01.md";

  assert.equal(isChatStreamingFor(slug, chatId), false);

  setChatStreaming(slug, chatId, true);
  assert.equal(isChatStreamingFor(slug, chatId), true);

  let abortedEng1 = false;
  let abortedEng2 = false;

  const ac1 = { abort: () => { abortedEng1 = true; } };
  const ac2 = { abort: () => { abortedEng2 = true; } };

  setChatAbortController(slug, chatId, "claude", ac1);
  setChatAbortController(slug, chatId, "gemini", ac2);

  // Cancelar motor individual (ex: na arena de comparação)
  cancelChatExecution(slug, chatId, "claude");
  assert.equal(abortedEng1, true);
  assert.equal(abortedEng2, false);
  // Ainda há gemini executando
  assert.equal(isChatStreamingFor(slug, chatId), true);

  // Cancelar todos
  cancelChatExecution(slug, chatId);
  assert.equal(abortedEng2, true);
  assert.equal(isChatStreamingFor(slug, chatId), false);
});

test("EP-02.08: setStreamingUI sincroniza botões nas 3 apresentações e cancelChatStream aborta graciosamente", async () => {
  const sendMain = mockElement("btnSendChat", { style: { display: "inline-flex" } });
  const cancelMain = mockElement("btnCancelChat", { style: { display: "none" } });
  const saveMain = mockElement("btnSaveChat", { disabled: false });

  const sendStudio = mockElement("btnSendStudioChat", { style: { display: "inline-flex" } });
  const cancelStudio = mockElement("btnCancelStudioChat", { style: { display: "none" } });
  const saveStudio = mockElement("btnSaveStudioChat", { disabled: false });

  const sendMini = mockElement("btnSendMiniChat", { style: { display: "inline-flex" } });
  const cancelMini = mockElement("btnCancelMiniChat", { style: { display: "none" } });

  const statusMain = mockElement("chatStatusText");
  const statusStudio = mockElement("studioChatStatusText");
  const statusMini = mockElement("miniChatStatusText");

  const { state } = await import("../ui/public/js/shared/state.js");
  const { setStreamingUI, cancelChatStream } = await import("../ui/public/js/modules/chat-stream-ui.js");

  state.P = { slug: "saude-dispensacao", chats: [] };
  state.chatTurns = [{ role: "user", text: "q1" }, { role: "assistant", text: "a1" }];

  // 1. Iniciar Streaming
  setStreamingUI(true);

  assert.equal(sendMain.style.display, "none");
  assert.equal(cancelMain.style.display, "inline-flex");
  assert.equal(saveMain.disabled, true);

  assert.equal(sendStudio.style.display, "none");
  assert.equal(cancelStudio.style.display, "inline-flex");
  assert.equal(saveStudio.disabled, true);

  assert.equal(sendMini.style.display, "none");
  assert.equal(cancelMini.style.display, "inline-flex");

  // 2. Interrupção via cancelChatStream
  cancelChatStream();

  assert.equal(sendMain.style.display, "inline-flex");
  assert.equal(cancelMain.style.display, "none");
  assert.equal(saveMain.disabled, false);

  assert.equal(sendStudio.style.display, "inline-flex");
  assert.equal(cancelStudio.style.display, "none");

  assert.equal(sendMini.style.display, "inline-flex");
  assert.equal(cancelMini.style.display, "none");

  assert.ok(statusMain.textContent.includes("interrompida"));
  assert.ok(statusStudio.textContent.includes("interrompida"));
  assert.ok(statusMini.textContent.includes("interrompida"));
});

test("EP-02.08: Hardening de erros e permissões com FontAwesome e zero emojis", async () => {
  const { errorHtml, permissionsHtml } = await import("../ui/public/js/modules/chat-errors-permissions.js");

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  // Erro formatado
  const errOut = errorHtml({ code: "client", title: "Falha de rede", message: "Timeout no servidor", hint: "Verifique conexão" });
  assert.equal(emojiRegex.test(errOut), false, "errorHtml não deve conter emojis");
  assert.ok(errOut.includes("fa-triangle-exclamation"), "Deve usar ícone FontAwesome de alerta");
  assert.ok(errOut.includes("fa-lightbulb"), "Deve usar ícone FontAwesome de dica");

  // Permissões
  const permsOut = permissionsHtml([
    { id: "p1", summary: "Executar git diff", state: "pending", scopes: ["once", "chat"] },
    { id: "p2", summary: "Ler config", state: "allowed", scope: "project" },
    { id: "p3", summary: "Acessar chaves", state: "denied" },
  ], true);

  assert.equal(emojiRegex.test(permsOut), false, "permissionsHtml não deve conter emojis");
  assert.ok(permsOut.includes("fa-shield-halved"), "Deve usar ícone de escudo para pedidos");
  assert.ok(permsOut.includes("fa-check"), "Deve usar ícone de check para permitido");
  assert.ok(permsOut.includes("fa-xmark"), "Deve usar ícone de xmark para negado");
});

test("EP-02.08: Auditoria arquitetural: zero emojis e limite estrito (< 300 linhas) em todos os módulos de chat", () => {
  const chatDir = path.join(rootDir, "ui", "public", "js", "modules");
  const files = fs.readdirSync(chatDir).filter((f) => f.startsWith("chat") && f.endsWith(".js"));

  assert.ok(files.length >= 15, "Deve haver todos os módulos de chat presentes");

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  files.forEach((file) => {
    const fullPath = path.join(chatDir, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);

    // 1. Limite por arquivo (< 250 a 300 linhas)
    assert.ok(
      lines.length <= 300,
      `Arquivo ${file} tem ${lines.length} linhas, excedendo o teto de 300 linhas!`
    );

    // 2. Zero emojis
    lines.forEach((l, idx) => {
      assert.equal(
        emojiRegex.test(l),
        false,
        `Emoji detectado em ${file}:${idx + 1} -> ${l}`
      );
    });
  });
});

test("HIA: RAM insuficiente avisa o usuário ao escolher o motor local", async () => {
  const toast = mockElement("syncToast");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ hardware: { viable: false, alert: "Memoria livre baixa (500 MB)." } }),
  });

  try {
    const { warnIfLocalInferenceUnsafe } = await import("../ui/public/js/modules/chat-hia-panel.js");
    const viable = await warnIfLocalInferenceUnsafe();

    assert.equal(viable, false);
    assert.match(toast.textContent, /Memoria livre baixa/, "o aviso de hardware chega à tela");
    assert.equal(toast.style.display, "inline-block");
    clearTimeout(/** @type {any} */ (toast)._timeout);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HIA: máquina apta ou métricas indisponíveis não geram aviso falso", async () => {
  const toast = mockElement("syncToast");
  const originalFetch = globalThis.fetch;
  try {
    const { warnIfLocalInferenceUnsafe } = await import("../ui/public/js/modules/chat-hia-panel.js");

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ hardware: { viable: true } }) });
    assert.equal(await warnIfLocalInferenceUnsafe(), true);
    assert.equal(toast.textContent, "", "nada é anunciado quando a máquina aguenta o modelo");

    globalThis.fetch = async () => { throw new Error("sem servidor"); };
    assert.equal(await warnIfLocalInferenceUnsafe(), true, "sem métricas, não alarmar");
    assert.equal(toast.textContent, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("HIA: a escolha do provedor Ollama está ligada ao aviso de hardware", () => {
  const src = fs.readFileSync(path.join(rootDir, "ui", "public", "js", "modules", "chat-ui-interaction.js"), "utf8");
  assert.match(src, /if \(engine === "ollama"\) warnIfLocalInferenceUnsafe\(\);/);
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const moduleUrl = (relativePath) => pathToFileURL(path.join(__dirname, "..", relativePath)).href;

function createMockStorage() {
  /** @type {Record<string, string>} */
  const s = {};
  return {
    getItem: (k) => (s[k] !== undefined ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { for (const k of Object.keys(s)) delete s[k]; },
  };
}

if (!global.localStorage) {
  // @ts-ignore
  global.localStorage = createMockStorage();
}
if (!global.$) {
  // @ts-ignore
  global.$ = () => null;
}
if (!global.Event) {
  // @ts-ignore
  global.Event = class { constructor(type) { this.type = type; } };
}


function createMockTextarea(initialValue = "") {
  /** @type {any[]} */
  const events = [];
  return {
    value: initialValue,
    selectionStart: initialValue.length,
    selectionEnd: initialValue.length,
    focused: false,
    focus() {
      this.focused = true;
    },
    dispatchEvent(e) {
      events.push(e);
      return true;
    },
    getEvents() {
      return events;
    },
  };
}

function createMockDocument(elementIds = []) {
  /** @type {Record<string, any>} */
  const map = {};
  for (const id of elementIds) {
    map[id] = { id, style: { display: "" } };
  }
  return {
    getElementById(id) {
      return map[id] || null;
    },
  };
}

test("studio-chat: getStudioChatElements resolve elementos a partir do contrato canônico de chatPresentation", async () => {
  const { getStudioChatElements } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  const ids = [
    "studioChatInput",
    "studioChatHistory",
    "studioChatScrollBottomBtn",
    "studioChatAttachTray",
    "studioChatStatusText",
    "studioChatSendButton",
    "btnSendStudioChat",
    "btnCancelStudioChat",
    "studioSidebar",
    "studioSidebarResizer",
  ];
  const doc = createMockDocument(ids);
  const elements = getStudioChatElements(doc);

  assert.ok(elements.input);
  assert.equal(elements.input.id, "studioChatInput");
  assert.ok(elements.sendButton);
  assert.equal(elements.sendButton.id, "btnSendStudioChat");
  assert.ok(elements.cancelButton);
  assert.equal(elements.cancelButton.id, "btnCancelStudioChat");
  assert.ok(elements.sidebar);
  assert.equal(elements.sidebar.id, "studioSidebar");
  assert.ok(elements.resizer);
  assert.equal(elements.resizer.id, "studioSidebarResizer");
});

test("studio-chat: formatContextBlock formata blocos semânticos de código, nós da árvore e prompts", async () => {
  const { formatContextBlock } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  // Bloco de código com linhas
  const codeBlock = formatContextBlock("code", {
    file: "src/app.component.ts",
    lines: "10-25",
    code: "export class AppComponent {}",
  });
  assert.match(codeBlock, /<contexto-codigo arquivo="src\/app\.component\.ts" linhas="10-25">/);
  assert.match(codeBlock, /export class AppComponent/);
  assert.match(codeBlock, /<\/contexto-codigo>/);

  // Bloco de nó do Prototype Engine
  const elemBlock = formatContextBlock("element", {
    nodeId: "card-paciente-1",
    component: "CardPaciente",
    selector: ".patient-card",
  });
  assert.match(elemBlock, /<contexto-elemento node-id="card-paciente-1" componente="CardPaciente" seletor="\.patient-card"><\/contexto-elemento>/);

  // Prompt puro
  const promptBlock = formatContextBlock("prompt", { text: "Ajuste as cores do cabeçalho" });
  assert.equal(promptBlock.trim(), "Ajuste as cores do cabeçalho");

  // Tipo inválido
  assert.equal(formatContextBlock("invalido", {}), "");
});

test("studio-chat: insertStudioContext insere contexto na posição do cursor e dispara evento de input", async () => {
  const { insertStudioContext } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  const textarea = createMockTextarea("Olá, por favor revise: ");
  const ok = insertStudioContext("code", {
    file: "button.ts",
    code: "export const btn = true;",
  }, textarea);

  assert.equal(ok, true);
  assert.match(textarea.value, /Olá, por favor revise: \n<contexto-codigo arquivo="button\.ts">/);
  assert.equal(textarea.focused, true);
  assert.equal(textarea.getEvents().length, 1);
});

test("studio-chat: handleStudioChatKey intercepta Enter sem Shift para envio e Escape para fechar menus", async () => {
  const { handleStudioChatKey } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  let sent = false;
  const mockSend = () => { sent = true; };

  // Enter sem Shift deve enviar
  let prevented = false;
  const enterEvent = {
    key: "Enter",
    shiftKey: false,
    preventDefault() { prevented = true; },
  };
  const handledEnter = handleStudioChatKey(enterEvent, mockSend);
  assert.equal(handledEnter, true);
  assert.equal(prevented, true);
  assert.equal(sent, true);

  // Shift+Enter NÃO deve enviar (deve permitir nova linha)
  let shiftPrevented = false;
  const shiftEnterEvent = {
    key: "Enter",
    shiftKey: true,
    preventDefault() { shiftPrevented = true; },
  };
  const handledShift = handleStudioChatKey(shiftEnterEvent, mockSend);
  assert.equal(handledShift, false);
  assert.equal(shiftPrevented, false);

  // Outra tecla não faz nada
  const otherEvent = {
    key: "KeyA",
    shiftKey: false,
    preventDefault() {},
  };
  assert.equal(handleStudioChatKey(otherEvent, mockSend), false);
});

test("studio-chat: toggleStudioChatSidebar alterna visibilidade preservando integridade", async () => {
  const { toggleStudioChatSidebar } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  // Sem elementos, retorna false com segurança
  assert.equal(toggleStudioChatSidebar(), false);

  // Com elementos mockados
  const sidebar = { style: { display: "" } };
  const resizer = { style: { display: "" } };
  // @ts-ignore
  const hidden = toggleStudioChatSidebar(false, { sidebar, resizer });
  assert.equal(hidden, false);
  assert.equal(sidebar.style.display, "none");
  assert.equal(resizer.style.display, "none");

  // @ts-ignore
  const shown = toggleStudioChatSidebar(true, { sidebar, resizer });
  assert.equal(shown, true);
  assert.equal(sidebar.style.display, "");
  assert.equal(resizer.style.display, "");
});

test("studio-chat: syncStudioChatDraft sincroniza rascunho de conversa no input", async () => {
  const { syncStudioChatDraft } = await import(moduleUrl("ui/public/js/modules/studio-chat.js"));

  // Sem input alvo, retorna vazio com segurança
  assert.equal(syncStudioChatDraft("rascunho"), "");

  // Com input mockado
  const mockInput = createMockTextarea("rascunho anterior");
  // @ts-ignore
  const updated = syncStudioChatDraft("novo rascunho", mockInput);
  assert.equal(updated, "novo rascunho");
  assert.equal(mockInput.value, "novo rascunho");
});


// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const presentationsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-presentations.js"), "utf8");
const miniJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-mini.js"), "utf8");
const streamUiJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-stream-ui.js"), "utf8");
const renderJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-render.js"), "utf8");
const miscHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "dialogs-misc.html"), "utf8");
const miniCss = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "css", "chat", "04-mini-chat-dock.css"), "utf8");

test("EP-02.03: Contrato canônico da apresentação compacta (CHAT_PRESENTATIONS.mini)", async () => {
  assert.match(presentationsJs, /mini: Object\.freeze/);
  assert.match(presentationsJs, /input: "miniChatInput"/);
  assert.match(presentationsJs, /history: "miniChatHistory"/);
  assert.match(presentationsJs, /attachTray: "miniChatAttachTray"/);
  assert.match(presentationsJs, /statusText: "miniChatStatusText"/);
  assert.match(presentationsJs, /sendButton: "btnSendMiniChat"/);
  assert.match(presentationsJs, /cancelButton: "btnCancelMiniChat"/);
  assert.match(presentationsJs, /widget: "miniChatWidget"/);
  assert.match(presentationsJs, /expandedBody: "miniChatExpandedBody"/);
  assert.match(presentationsJs, /expandButton: "btnMiniChatExpand"/);
  assert.match(presentationsJs, /restoreButton: "btnMiniChatRestore"/);
  assert.match(presentationsJs, /studioButton: "btnMiniChatStudio"/);
  assert.match(presentationsJs, /closeButton: "btnMiniChatClose"/);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(presentationsJs).toString("base64")}`;
  const mod = await import(moduleUrl);

  const miniContract = mod.chatPresentation("mini");
  assert.equal(miniContract.input, "miniChatInput");
  assert.equal(miniContract.history, "miniChatHistory");
  assert.equal(miniContract.attachTray, "miniChatAttachTray");
  assert.equal(miniContract.sendButton, "btnSendMiniChat");
  assert.equal(miniContract.cancelButton, "btnCancelMiniChat");

  assert.equal(mod.isCompactPresentation("mini"), true);
  assert.equal(mod.isCompactPresentation("main"), false);
  assert.equal(mod.isCompactPresentation("studio"), false);
});

test("EP-02.03: Marcação HTML em dialogs-misc.html atende integralmente ao contrato", () => {
  // Container principal do dock
  assert.ok(miscHtml.includes('id="miniChatWidget"'), "miniChatWidget presente");
  assert.ok(miscHtml.includes('class="mini-chat-dock"'), "classe mini-chat-dock presente");

  // Cabeçalho e identificadores visuais
  assert.ok(miscHtml.includes('id="miniChatDot"'), "miniChatDot presente");
  assert.ok(miscHtml.includes('id="miniChatEngineBadge"'), "miniChatEngineBadge presente");
  assert.ok(miscHtml.includes('id="miniChatTitle"'), "miniChatTitle presente");
  assert.ok(miscHtml.includes('id="miniChatStatusBadge"'), "miniChatStatusBadge presente");

  // Ações do cabeçalho
  assert.ok(miscHtml.includes('id="btnMiniChatExpand"'), "btnMiniChatExpand presente");
  assert.ok(miscHtml.includes('id="btnMiniChatRestore"'), "btnMiniChatRestore presente");
  assert.ok(miscHtml.includes('id="btnMiniChatStudio"'), "btnMiniChatStudio presente");
  assert.ok(miscHtml.includes('id="btnMiniChatClose"'), "btnMiniChatClose presente");

  // Corpo recolhido
  assert.ok(miscHtml.includes('id="miniChatBody"'), "miniChatBody presente");
  assert.ok(miscHtml.includes('id="miniChatPreviewText"'), "miniChatPreviewText presente");
  assert.ok(miscHtml.includes('id="miniChatStreamIndicator"'), "miniChatStreamIndicator presente");
  assert.ok(miscHtml.includes('id="miniChatStreamText"'), "miniChatStreamText presente");

  // Corpo expandido
  assert.ok(miscHtml.includes('id="miniChatExpandedBody"'), "miniChatExpandedBody presente");
  assert.ok(miscHtml.includes('id="miniChatHistory"'), "miniChatHistory presente");
  assert.ok(miscHtml.includes('id="miniChatAttachTray"'), "miniChatAttachTray presente");
  assert.ok(miscHtml.includes('id="miniChatInput"'), "miniChatInput presente");
  assert.ok(miscHtml.includes('id="btnSendMiniChat"'), "btnSendMiniChat presente");
  assert.ok(miscHtml.includes('id="btnCancelMiniChat"'), "btnCancelMiniChat presente");
  assert.ok(miscHtml.includes('id="miniChatStatusText"'), "miniChatStatusText presente");
});

test("EP-02.03: Estilização do dock (04-mini-chat-dock.css) obedece à especificação visual e layout", () => {
  // Posição flutuante fixa
  assert.ok(miniCss.includes(".mini-chat-dock"), "Classe .mini-chat-dock definida");
  assert.ok(miniCss.includes("position: fixed"), "Dock fixado na tela");
  assert.ok(miniCss.includes("z-index: 9998"), "Z-index alto para sobreposição correta");

  // Animação de pulso no streaming
  assert.ok(miniCss.includes(".mini-chat-dot.streaming"), "Dot de streaming animado");
  assert.ok(miniCss.includes("@keyframes pulseMini"), "Keyframes pulseMini definidos");

  // Modo expandido
  assert.ok(miniCss.includes(".mini-chat-dock.expanded"), "Classe .expanded com dimensões dedicadas");
  assert.ok(miniCss.includes(".mini-chat-expanded-body"), "Container expandido estilizado");
  assert.ok(miniCss.includes(".mini-chat-history"), "Histórico compacto estilizado");
  assert.ok(miniCss.includes(".mini-chat-composer"), "Compositor compacto estilizado");
});

test("EP-02.03: Lógica de controle em chat-mini.js suporta ciclo completo de vida", () => {
  assert.match(miniJs, /export function updateMiniChatWidget/);
  assert.match(miniJs, /export function showMiniChatWidget/);
  assert.match(miniJs, /export function hideMiniChatWidget/);
  assert.match(miniJs, /export function dismissMiniChat/);
  assert.match(miniJs, /export function minimizeCurrentChat/);
  assert.match(miniJs, /export function restoreChatFromMini/);
  assert.match(miniJs, /export function restoreChatToStudio/);
  assert.match(miniJs, /export function toggleMiniWidgetExpand/);
  assert.match(miniJs, /export function handleMiniChatKey/);
  assert.match(miniJs, /export function sendMiniChatMessage/);

  // Envio direto do mini sem mutação do input principal
  assert.match(miniJs, /window\.sendChatMessage\("mini"\)/);
  assert.doesNotMatch(miniJs, /mainInp\.value = inp\.value/);

  // Origem preservada ao restaurar
  assert.match(miniJs, /cs\.miniChatOrigin/);
});

test("EP-02.03: Sincronização de streaming e cancelamento na apresentação compacta", () => {
  // Alternância de botões send/cancel na mini apresentação
  assert.match(streamUiJs, /\$\("btnSendMiniChat"\)/);
  assert.match(streamUiJs, /\$\("btnCancelMiniChat"\)/);
  assert.match(streamUiJs, /sendMiniBtn\.style\.display = streaming \? "none" : "inline-flex"/);
  assert.match(streamUiJs, /cancelMiniBtn\.style\.display = streaming \? "inline-flex" : "none"/);

  // Histórico mini registrado em chat-render.js
  assert.match(renderJs, /\$\("miniChatHistory"\)/);
});

test("EP-02.03: Proibição estrita de emojis nos arquivos da apresentação compacta", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

  // Extrair o bloco do miniChatWidget de miscHtml
  const miniDockMatch = miscHtml.match(/<div id="miniChatWidget"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert.ok(miniDockMatch, "Bloco miniChatWidget encontrado no HTML");
  assert.equal(emojiRegex.test(miniDockMatch[0]), false, "Zero emojis no markup do mini widget");

  // Validar chat-mini.js
  assert.equal(emojiRegex.test(miniJs), false, "Zero emojis em chat-mini.js");

  // Validar chat-presentations.js
  assert.equal(emojiRegex.test(presentationsJs), false, "Zero emojis em chat-presentations.js");
});

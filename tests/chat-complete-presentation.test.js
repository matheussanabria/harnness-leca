// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const presentationsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-presentations.js"), "utf8");
const streamUiJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-stream-ui.js"), "utf8");
const sendJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-send.js"), "utf8");
const chatHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "dialogs-chat.html"), "utf8");

test("EP-02.05: Contrato canônico da apresentação completa (CHAT_PRESENTATIONS.main)", async () => {
  assert.match(presentationsJs, /main: Object\.freeze/);
  assert.match(presentationsJs, /input: "chatInput"/);
  assert.match(presentationsJs, /history: "chatHistory"/);
  assert.match(presentationsJs, /scrollButton: "chatScrollBottomBtn"/);
  assert.match(presentationsJs, /attachTray: "chatAttachTray"/);
  assert.match(presentationsJs, /statusText: "chatStatusText"/);
  assert.match(presentationsJs, /sendButton: "btnSendChat"/);
  assert.match(presentationsJs, /cancelButton: "btnCancelChat"/);
  assert.match(presentationsJs, /dialog: "chatDlg"/);
  assert.match(presentationsJs, /compareToggle: "btnToggleCompareMode"/);
  assert.match(presentationsJs, /compareControls: "compareControls"/);
  assert.match(presentationsJs, /singleControls: "singleControls"/);
  assert.match(presentationsJs, /fileInput: "chatFileInput"/);
  assert.match(presentationsJs, /dashboardButton: "btnChatDashboard"/);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(presentationsJs).toString("base64")}`;
  const mod = await import(moduleUrl);

  const mainContract = mod.chatPresentation("main");
  assert.equal(mainContract.input, "chatInput");
  assert.equal(mainContract.history, "chatHistory");
  assert.equal(mainContract.dialog, "chatDlg");
  assert.equal(mainContract.sendButton, "btnSendChat");
  assert.equal(mainContract.cancelButton, "btnCancelChat");

  assert.equal(mod.isMainPresentation("main"), true);
  assert.equal(mod.isMainPresentation(""), true);
  assert.equal(mod.isMainPresentation(undefined), true);
  assert.equal(mod.isMainPresentation("studio"), false);
  assert.equal(mod.isMainPresentation("mini"), false);
});

test("EP-02.05: Markup da Central de Conversas em dialogs-chat.html atende integralmente ao contrato", () => {
  // Container modal
  assert.ok(chatHtml.includes('id="chatDlg"'), "chatDlg presente");
  assert.ok(chatHtml.includes('class="chat-dialog"'), "classe chat-dialog presente");

  // Provedores e cabeçalho
  assert.ok(chatHtml.includes('id="chatProviderBtn"'), "chatProviderBtn presente");
  assert.ok(chatHtml.includes('id="providerDropdownMenu"'), "providerDropdownMenu presente");
  assert.ok(chatHtml.includes('data-eng="claude"'), "Opção Claude presente");
  assert.ok(chatHtml.includes('data-eng="opencode"'), "Opção OpenCode presente");
  assert.ok(chatHtml.includes('data-eng="gemini"'), "Opção Gemini presente");
  assert.ok(chatHtml.includes('data-eng="codex"'), "Opção Codex presente");
  assert.ok(chatHtml.includes('data-eng="ollama"'), "Opção Ollama Local presente");
  assert.ok(chatHtml.includes('data-eng="compare"'), "Opção Comparar presente");

  // Ações de cabeçalho
  assert.ok(chatHtml.includes('id="btnToggleCompareMode"'), "btnToggleCompareMode presente");
  assert.ok(chatHtml.includes('id="btnChatDashboard"'), "btnChatDashboard presente");
  assert.ok(chatHtml.includes('id="btnChatMore"'), "btnChatMore presente");
  assert.ok(chatHtml.includes('id="chatMoreMenu"'), "chatMoreMenu presente");

  // Barra de contexto e configurações
  assert.ok(chatHtml.includes('id="singleControls"'), "singleControls presente");
  assert.ok(chatHtml.includes('id="modalDaiSelect"'), "modalDaiSelect presente");
  assert.ok(chatHtml.includes('id="chatModelSelect"'), "chatModelSelect presente");
  assert.ok(chatHtml.includes('id="btnChatSettings"'), "btnChatSettings presente");
  assert.ok(chatHtml.includes('id="chatSettingsPopover"'), "chatSettingsPopover presente");
  assert.ok(chatHtml.includes('id="effortToggle"'), "effortToggle presente");

  // Arena de comparação
  assert.ok(chatHtml.includes('id="compareControls"'), "compareControls presente");
  assert.ok(chatHtml.includes('id="chipClaude"'), "chipClaude presente");
  assert.ok(chatHtml.includes('id="chipGemini"'), "chipGemini presente");
  assert.ok(chatHtml.includes('id="chipOpencode"'), "chipOpencode presente");
  assert.ok(chatHtml.includes('id="chipCodex"'), "chipCodex presente");
  assert.ok(chatHtml.includes('id="chipOllama"'), "chipOllama presente");
  assert.ok(chatHtml.includes('id="compareSummaryBadge"'), "compareSummaryBadge presente");

  // Histórico e compositor
  assert.ok(chatHtml.includes('id="chatHistory"'), "chatHistory presente");
  assert.ok(chatHtml.includes('id="chatAttachTray"'), "chatAttachTray presente");
  assert.ok(chatHtml.includes('id="chatFileInput"'), "chatFileInput presente");
  assert.ok(chatHtml.includes('id="chatInput"'), "chatInput presente");
  assert.ok(chatHtml.includes('id="btnComposerAdd"'), "btnComposerAdd presente");
  assert.ok(chatHtml.includes('id="composerAddMenu"'), "composerAddMenu presente");
  assert.ok(chatHtml.includes('id="btnComposerTools"'), "btnComposerTools presente");
  assert.ok(chatHtml.includes('id="composerToolsMenu"'), "composerToolsMenu presente");
  assert.ok(chatHtml.includes('id="btnSendChat"'), "btnSendChat presente");
  assert.ok(chatHtml.includes('id="btnCancelChat"'), "btnCancelChat presente");
  assert.ok(chatHtml.includes('id="chatStatusText"'), "chatStatusText presente");
  assert.ok(chatHtml.includes('id="chatScrollBottomBtn"'), "chatScrollBottomBtn presente");
});

test("EP-02.05: Fluxo de abertura e inicialização em chat-stream-ui.js", () => {
  assert.match(streamUiJs, /export function openInteractiveChat/);
  assert.match(streamUiJs, /restoreActiveChatState\(P\.slug\)/);
  assert.match(streamUiJs, /hideMiniChatWidget\(\)/);
  assert.match(streamUiJs, /\$\("chatDlg"\)\)\.showModal\(\)/);
  assert.match(streamUiJs, /renderChatHistory\(\)/);
  assert.match(streamUiJs, /const inp = \$\("chatInput"\)/);
  assert.match(streamUiJs, /inp\.focus\(\)/);
});

test("EP-02.05: Compositor autônomo e manipulação de teclado em chat-stream-ui.js e chat-send.js", () => {
  assert.match(streamUiJs, /export function handleChatKey/);
  assert.match(streamUiJs, /if \(e\.key === "Enter" && !e\.shiftKey\)/);
  assert.match(streamUiJs, /sendChatMessage\(\)/);

  assert.match(sendJs, /export async function sendChatMessage\(presentation = "main"\)/);
  assert.match(sendJs, /chatPresentation\(presentation\)\.input/);
});

test("EP-02.05: Controle de streaming e cancelamento na apresentação completa", () => {
  assert.match(streamUiJs, /\$\("btnSendChat"\)/);
  assert.match(streamUiJs, /\$\("btnCancelChat"\)/);
  assert.match(streamUiJs, /sendBtn\.style\.display = streaming \? "none" : "inline-flex"/);
  assert.match(streamUiJs, /cancelBtn\.style\.display = streaming \? "inline-flex" : "none"/);
  assert.match(streamUiJs, /export function cancelChatStream\(\)/);
  assert.match(streamUiJs, /cancelChatExecution\(P\.slug, cs\.currentChatFile\)/);
});

test("EP-02.05: Padrão visual estrito de ícones FontAwesome (zero emojis na apresentação completa)", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

  // dialogs-chat.html
  assert.equal(emojiRegex.test(chatHtml), false, "Zero emojis no markup de dialogs-chat.html");

  // chat-stream-ui.js
  assert.equal(emojiRegex.test(streamUiJs), false, "Zero emojis em chat-stream-ui.js");

  // chat-presentations.js
  assert.equal(emojiRegex.test(presentationsJs), false, "Zero emojis em chat-presentations.js");
});

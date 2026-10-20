// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const presentationsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-presentations.js"), "utf8");
const studioCoreJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-core.js"), "utf8");
const studioLayoutPath = path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-layout.js");
const studioLayoutJs = fs.existsSync(studioLayoutPath) ? fs.readFileSync(studioLayoutPath, "utf8") : "";
const studioResizerCode = studioCoreJs + "\n" + studioLayoutJs;
const studioCompanionJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-companion.js"), "utf8");
const streamUiJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-stream-ui.js"), "utf8");
const studioHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "studio.html"), "utf8");
const studioDrawerHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "studio-drawer.html"), "utf8");

test("EP-02.04: Contrato canônico da apresentação lateral (CHAT_PRESENTATIONS.studio)", async () => {
  assert.match(presentationsJs, /studio: Object\.freeze/);
  assert.match(presentationsJs, /input: "studioChatInput"/);
  assert.match(presentationsJs, /history: "studioChatHistory"/);
  assert.match(presentationsJs, /scrollButton: "studioChatScrollBottomBtn"/);
  assert.match(presentationsJs, /attachTray: "studioChatAttachTray"/);
  assert.match(presentationsJs, /statusText: "studioChatStatusText"/);
  assert.match(presentationsJs, /sendButton: "btnSendStudioChat"/);
  assert.match(presentationsJs, /cancelButton: "btnCancelStudioChat"/);
  assert.match(presentationsJs, /sidebar: "studioSidebar"/);
  assert.match(presentationsJs, /resizer: "studioSidebarResizer"/);
  assert.match(presentationsJs, /compareToggle: "btnToggleStudioCompareMode"/);
  assert.match(presentationsJs, /compareControls: "studioCompareControls"/);
  assert.match(presentationsJs, /singleControls: "studioSingleControls"/);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(presentationsJs).toString("base64")}`;
  const mod = await import(moduleUrl);

  const studioContract = mod.chatPresentation("studio");
  assert.equal(studioContract.input, "studioChatInput");
  assert.equal(studioContract.history, "studioChatHistory");
  assert.equal(studioContract.sidebar, "studioSidebar");
  assert.equal(studioContract.resizer, "studioSidebarResizer");
  assert.equal(studioContract.sendButton, "btnSendStudioChat");
  assert.equal(studioContract.cancelButton, "btnCancelStudioChat");

  assert.equal(mod.isSidebarPresentation("studio"), true);
  assert.equal(mod.isSidebarPresentation("main"), false);
  assert.equal(mod.isSidebarPresentation("mini"), false);
});

test("EP-02.04: Markup da barra lateral no studio.html possui todos os componentes canônicos", () => {
  // Container lateral
  assert.ok(studioHtml.includes('id="studioSidebar"'), "studioSidebar presente");
  assert.ok(studioHtml.includes('class="studio-sidebar"'), "classe studio-sidebar presente");

  // Provedores e cabeçalho
  assert.ok(studioHtml.includes('id="studioProviderBtn"'), "studioProviderBtn presente");
  assert.ok(studioHtml.includes('id="studioProviderDropdownMenu"'), "studioProviderDropdownMenu presente");
  assert.ok(studioHtml.includes('data-eng="ollama"'), "Opção Ollama Local no Studio");
  assert.ok(studioHtml.includes('id="btnToggleStudioCompareMode"'), "btnToggleStudioCompareMode presente");
  assert.ok(studioHtml.includes('id="btnStudioChatMore"'), "btnStudioChatMore presente");
  assert.ok(studioHtml.includes('id="studioChatMoreMenu"'), "studioChatMoreMenu presente");

  // Controles de contexto e modo de comparação
  assert.ok(studioHtml.includes('id="studioSingleControls"'), "studioSingleControls presente");
  assert.ok(studioHtml.includes('id="studioDaiSelect"'), "studioDaiSelect presente");
  assert.ok(studioHtml.includes('id="studioModelSelect"'), "studioModelSelect presente");
  assert.ok(studioHtml.includes('id="btnStudioChatSettings"'), "btnStudioChatSettings presente");
  assert.ok(studioHtml.includes('id="studioChatSettingsPopover"'), "studioChatSettingsPopover presente");
  assert.ok(studioHtml.includes('id="studioCompareControls"'), "studioCompareControls presente");
  assert.ok(studioHtml.includes('id="studioChipClaude"'), "studioChipClaude presente");
  assert.ok(studioHtml.includes('id="studioChipGemini"'), "studioChipGemini presente");
  assert.ok(studioHtml.includes('id="studioChipOpencode"'), "studioChipOpencode presente");
  assert.ok(studioHtml.includes('id="studioChipCodex"'), "studioChipCodex presente");
  assert.ok(studioHtml.includes('id="studioChipOllama"'), "studioChipOllama presente");

  // Histórico e compositor
  assert.ok(studioHtml.includes('id="studioChatHistory"'), "studioChatHistory presente");
  assert.ok(studioHtml.includes('id="studioChatAttachTray"'), "studioChatAttachTray presente");
  assert.ok(studioHtml.includes('id="studioChatInput"'), "studioChatInput presente");
  assert.ok(studioHtml.includes('id="btnStudioComposerAdd"'), "btnStudioComposerAdd presente");
  assert.ok(studioHtml.includes('id="studioComposerAddMenu"'), "studioComposerAddMenu presente");
  assert.ok(studioHtml.includes('id="btnStudioComposerTools"'), "btnStudioComposerTools presente");
  assert.ok(studioHtml.includes('id="studioComposerToolsMenu"'), "studioComposerToolsMenu presente");
  assert.ok(studioHtml.includes('id="btnSendStudioChat"'), "btnSendStudioChat presente");
  assert.ok(studioHtml.includes('id="btnCancelStudioChat"'), "btnCancelStudioChat presente");
  assert.ok(studioHtml.includes('id="studioChatStatusText"'), "studioChatStatusText presente");
  assert.ok(studioHtml.includes('id="studioChatScrollBottomBtn"'), "studioChatScrollBottomBtn presente");
});

test("EP-02.04: Divisor studioSidebarResizer possui marcação semântica e acessibilidade ARIA", () => {
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?role="separator"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?tabindex="0"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-label="Redimensionar painel do chat"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-orientation="vertical"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-controls="studioSidebar"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-valuemin="300"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-valuemax="850"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-valuenow="440"/);
});

test("EP-02.04: Lógica do resizer em studio-core.js suporta ponteiro, teclado, limites e persistência", () => {
  // Ponteiro com setPointerCapture
  assert.match(studioResizerCode, /resizer\.setPointerCapture\?\.\(e\.pointerId\)/);
  assert.match(studioResizerCode, /resizer\.releasePointerCapture\?\.\(e\.pointerId\)/);
  assert.match(studioResizerCode, /addEventListener\("pointerdown"/);
  assert.match(studioResizerCode, /addEventListener\("pointermove"/);
  assert.match(studioResizerCode, /addEventListener\("pointerup"/);

  // Teclado com passos e extremos
  assert.match(studioResizerCode, /addEventListener\("keydown"/);
  assert.match(studioResizerCode, /e\.key === "ArrowLeft"/);
  assert.match(studioResizerCode, /e\.key === "ArrowRight"/);
  assert.match(studioResizerCode, /e\.key === "Home"/);
  assert.match(studioResizerCode, /e\.key === "End"/);

  // Persistência em localStorage
  assert.match(studioResizerCode, /localStorage\.setItem\(/);
  assert.match(studioResizerCode, /harness_studio_sidebar_width/);

  // Limites e atualização de ARIA
  assert.match(studioResizerCode, /(?:function studioSidebarBounds|calculateSidebarBounds)/);
  assert.match(studioResizerCode, /resizer\.setAttribute\("aria-valuenow"/);
  assert.match(studioResizerCode, /resizer\.setAttribute\("aria-valuemin"/);
  assert.match(studioResizerCode, /resizer\.setAttribute\("aria-valuemax"/);
});

test("EP-02.04: Envio autônomo e sincronização de streaming na apresentação lateral", () => {
  // Envio direto do Studio para o sendChatMessage("studio")
  assert.match(studioCompanionJs, /export function sendStudioChatMessage/);
  assert.match(studioCompanionJs, /sendChatMessage\("studio"\)/);
  assert.doesNotMatch(studioCompanionJs, /\$\("chatInput"\)/);

  // Alternância de botões send/cancel na lateral durante streaming
  assert.match(streamUiJs, /\$\("btnSendStudioChat"\)/);
  assert.match(streamUiJs, /\$\("btnCancelStudioChat"\)/);
  assert.match(streamUiJs, /sendStudioBtn\.style\.display = streaming \? "none" : "inline-flex"/);
  assert.match(streamUiJs, /cancelStudioBtn\.style\.display = streaming \? "inline-flex" : "none"/);
});

test("EP-02.04: Padrão visual estrito de ícones FontAwesome (zero emojis no Studio e gavetas)", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

  // studio.html
  assert.equal(emojiRegex.test(studioHtml), false, "Zero emojis no markup de studio.html");

  // studio-drawer.html
  assert.equal(emojiRegex.test(studioDrawerHtml), false, "Zero emojis no markup de studio-drawer.html");

  // studio-core.js e studio-companion.js
  assert.equal(emojiRegex.test(studioCoreJs), false, "Zero emojis em studio-core.js");
  assert.equal(emojiRegex.test(studioCompanionJs), false, "Zero emojis em studio-companion.js");
});

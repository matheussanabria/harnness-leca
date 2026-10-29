// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const chatHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "dialogs-chat.html"), "utf8");
const studioHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "studio.html"), "utf8");
const miscHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "partials", "dialogs-misc.html"), "utf8");
const mobileCss = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "css", "chat-mobile.css"), "utf8");
const popoversCss = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "css", "chat", "04-chat-popovers.css"), "utf8");
const miniJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-mini.js"), "utf8");
const sendJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-send.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "app.js"), "utf8");
const renderJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-render.js"), "utf8");
const attachmentsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-attachments.js"), "utf8");
const chatFacadeJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat.js"), "utf8");
const studioCoreJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-core.js"), "utf8");
const studioLayoutJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-layout.js"), "utf8");
const interactionJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-ui-interaction.js"), "utf8");
const presentationsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-presentations.js"), "utf8");
const studioCompanionJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "studio-companion.js"), "utf8");
const enginesJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-engines.js"), "utf8");
const sessionsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-session-store.js"), "utf8");
const executionsJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-execution-store.js"), "utf8");
const streamUiJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-stream-ui.js"), "utf8");
const storeJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-store.js"), "utf8");
const persistJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-persist.js"), "utf8");

test("Fidelidade HTML: dialogs-chat.html possui todos os controles, menus e popovers esperados", () => {
  // Cabeçalho e seletor de provedores
  assert.ok(chatHtml.includes('id="chatProviderBtn"'), "chatProviderBtn presente");
  assert.ok(chatHtml.includes('id="providerDropdownMenu"'), "providerDropdownMenu presente");
  assert.ok(chatHtml.includes('data-eng="claude"'), "Opção Claude presente");
  assert.ok(chatHtml.includes('data-eng="opencode"'), "Opção OpenCode presente");
  assert.ok(chatHtml.includes('data-eng="gemini"'), "Opção Gemini presente");
  assert.ok(chatHtml.includes('data-eng="codex"'), "Opção Codex presente");
  assert.ok(chatHtml.includes('data-eng="compare"'), "Opção Comparar presente");

  // Menu de três pontos com todas as 8 ações
  assert.ok(chatHtml.includes('id="btnChatMore"'), "btnChatMore presente");
  assert.ok(chatHtml.includes('id="chatMoreMenu"'), "chatMoreMenu presente");
  assert.ok(chatHtml.includes("Novo Chat"), "Ação Novo Chat presente");
  assert.ok(chatHtml.includes("Continuar Conversa"), "Ação Continuar Conversa presente");
  assert.ok(chatHtml.includes("Salvar no Projeto"), "Ação Salvar no Projeto presente");
  assert.ok(chatHtml.includes("Sincronizar Conversas"), "Ação Sincronizar Conversas presente");
  assert.ok(chatHtml.includes("Permissões"), "Ação Permissões presente");
  assert.ok(chatHtml.includes("Abrir no Studio"), "Ação Abrir no Studio presente");
  assert.ok(chatHtml.includes("Minimizar para Widget"), "Ação Minimizar para Widget presente");
  assert.ok(chatHtml.includes("Fechar Chat"), "Ação Fechar Chat presente");
  assert.ok(chatHtml.includes("text-danger"), "Ação destrutiva com destaque vermelho");

  // Barra de contexto e modo comparação
  assert.ok(chatHtml.includes('id="singleControls"'), "singleControls presente");
  assert.ok(chatHtml.includes('id="modalDaiSelect"'), "modalDaiSelect presente");
  assert.ok(chatHtml.includes('id="chatModelSelect"'), "chatModelSelect presente");
  assert.ok(chatHtml.includes('id="btnChatSettings"'), "btnChatSettings presente");
  assert.ok(chatHtml.includes('id="compareControls"'), "compareControls presente");
  assert.ok(chatHtml.includes('id="chipClaude"'), "chipClaude presente");
  assert.ok(chatHtml.includes('id="chipGemini"'), "chipGemini presente");
  assert.ok(chatHtml.includes('id="chipOpencode"'), "chipOpencode presente");

  // Compositor, anexos e ações rápidas
  assert.ok(chatHtml.includes('id="chatInput"'), "chatInput presente");
  assert.ok(chatHtml.includes('id="btnComposerAdd"'), "btnComposerAdd presente");
  assert.ok(chatHtml.includes('id="composerAddMenu"'), "composerAddMenu presente");
  assert.ok(chatHtml.includes("Upload de Arquivos"), "Opção Upload presente");
  assert.ok(chatHtml.includes("Ver Skills Disponíveis"), "Opção Ver Skills presente");
  assert.ok(chatHtml.includes("Adicionar Nova Skill"), "Opção Nova Skill presente");
  assert.ok(chatHtml.includes("Revisar Memórias"), "Opção Revisar Memórias presente");

  assert.ok(chatHtml.includes('id="btnComposerTools"'), "btnComposerTools presente");
  assert.ok(chatHtml.includes('id="composerToolsMenu"'), "composerToolsMenu presente");
  assert.ok(chatHtml.includes("AÇÕES RÁPIDAS") || chatHtml.includes("Ações Rápidas"), "Título Ações Rápidas presente");
  assert.ok(chatHtml.includes("Design System"), "Ação rápida Design System");
  assert.ok(chatHtml.includes("Nova Interface"), "Ação rápida Nova Interface");
  assert.ok(chatHtml.includes("Corrigir Visual"), "Ação rápida Corrigir Visual");
  assert.ok(chatHtml.includes("Clean Code"), "Ação rápida Clean Code");
  assert.ok(chatHtml.includes('id="btnSendChat"'), "btnSendChat presente");
});

test("Unificação com Studio: studio.html possui paridade de controles, menus, upload e resizer", () => {
  // Provedores e cabeçalho
  assert.ok(studioHtml.includes('id="studioProviderBtn"'), "studioProviderBtn presente");
  assert.ok(studioHtml.includes('id="studioProviderDropdownMenu"'), "studioProviderDropdownMenu presente");
  assert.ok(studioHtml.includes('id="studioProviderDropdownMenu"') && studioHtml.includes('data-eng="codex"'), "Codex disponível no dropdown do Studio");
  assert.ok(studioHtml.includes('id="btnToggleStudioCompareMode"'), "btnToggleStudioCompareMode presente");
  assert.ok(studioHtml.includes('id="btnStudioChatMore"'), "btnStudioChatMore presente");
  assert.ok(studioHtml.includes('id="studioChatMoreMenu"'), "studioChatMoreMenu presente");
  assert.ok(studioHtml.includes("Permissões"), "Permissões disponível no Studio");
  assert.ok(studioHtml.includes("Minimizar para Widget"), "Minimizar para Widget no Studio");
  assert.ok(studioHtml.includes("Fechar Studio"), "Fechar Studio no menu");

  // Controles de contexto e modo de comparação no Studio
  assert.ok(studioHtml.includes('id="studioSingleControls"'), "studioSingleControls presente");
  assert.ok(studioHtml.includes('id="studioCompareControls"'), "studioCompareControls sincronizado no Studio");
  assert.ok(studioHtml.includes('id="studioChipClaude"'), "studioChipClaude presente");
  assert.ok(studioHtml.includes('id="studioChipGemini"'), "studioChipGemini presente");
  assert.ok(studioHtml.includes('id="studioChipOpencode"'), "studioChipOpencode presente");
  assert.ok(studioHtml.includes('id="studioChipCodex"'), "studioChipCodex presente");

  // Anexos e compositor no Studio
  assert.ok(studioHtml.includes('id="studioChatAttachTray"'), "studioChatAttachTray presente");
  assert.ok(studioHtml.includes('id="btnStudioComposerAdd"'), "btnStudioComposerAdd presente");
  assert.ok(studioHtml.includes("Upload de Arquivos"), "Upload de Arquivos disponível no Studio");
  assert.ok(studioHtml.includes('fa-paperclip') && studioHtml.includes('onclick="pickChatFiles()"'), "Atalho direto de anexo com paperclip presente no Studio");
  assert.ok(studioHtml.includes('id="btnStudioComposerTools"'), "btnStudioComposerTools presente");
  assert.ok(studioHtml.includes('id="btnSendStudioChat"'), "btnSendStudioChat presente");
  assert.ok(studioHtml.includes('id="studioSidebarResizer"'), "Divisor redimensionável studioSidebarResizer presente");
});

test("Widget Flutuante: dialogs-misc.html possui botões de expansão, restauração e envio rápido", () => {
  assert.ok(miscHtml.includes('id="miniChatWidget"'), "miniChatWidget presente");
  assert.ok(miscHtml.includes('id="btnMiniChatExpand"'), "btnMiniChatExpand presente");
  assert.ok(miscHtml.includes('id="miniChatExpandedBody"'), "miniChatExpandedBody presente");
  assert.ok(miscHtml.includes('id="miniChatInput"'), "miniChatInput presente");
  assert.ok(miscHtml.includes('id="miniChatHistory" class="chat-history'), "Histórico reutiliza o esqueleto mobile");
  assert.ok(miscHtml.includes('class="chat-composer-container mini-chat-composer"'), "Compositor reutiliza o esqueleto mobile");
  assert.ok(miscHtml.includes('id="btnCancelMiniChat"'), "Widget permite interromper o streaming");
  assert.ok(chatHtml.includes("minimizeCurrentChat('dialog')") || chatHtml.includes("minimizeChatModal()"), "Chat modal suporta minimizar");
  assert.ok(studioHtml.includes("minimizeCurrentChat('studio')") || studioHtml.includes("minimizeCurrentChat()"), "Studio suporta minimizar para widget");
});

test("Chat minimizado compartilha renderização, anexos e streaming do chat principal", () => {
  assert.match(renderJs, /\$\("miniChatHistory"\)/);
  assert.match(attachmentsJs, /\$\("miniChatAttachTray"\)/);
  assert.match(sendJs, /\$\("miniChatInput"\)/);
  assert.match(sendJs, /chatPresentation\(presentation\)\.input/);
  assert.match(miniJs, /window\.handleChatInput\(input\)/);
  assert.match(chatFacadeJs, /handleMiniChatInput/);
  assert.doesNotMatch(chatFacadeJs, /renderMiniChatHistory/);
});

test("Widget flutuante detecta o modal aberto sem interromper a atualização", () => {
  assert.match(miniJs, /const isModalOpen = Boolean\(dlg\?\.open\)/);
  assert.match(miniJs, /isModalOpen \|\| isSidebarVisible/);
  assert.match(miniJs, /isSidebarInAtelier\(\)/);
});

test("Clique programático no input de arquivo não fecha o dialog", () => {
  assert.match(appJs, /if \(e\.target === d\)/);
  assert.doesNotMatch(appJs, /e\.clientY.*e\.clientX/);
});

test("Modo comparativo usa a seleção armazenada no estado do chat", () => {
  const compareJs = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "js", "modules", "chat-send-compare.js"), "utf8");
  assert.match(compareJs, /\.\.\.cs\.compareSelectedEngines/);
  assert.match(sendJs, /runComparison\(/);
});

test("Responsividade e Container Queries: chat-mobile.css e popovers obedecem à especificação", () => {
  assert.ok(mobileCss.includes("container-type: inline-size"), "Container type inline-size habilitado");
  assert.ok(mobileCss.includes("@container (max-width: 460px)"), "Container query de 460px definida");
  assert.ok(mobileCss.includes("env(safe-area-inset-bottom"), "Respeito à safe-area mobile");
  assert.ok(mobileCss.includes(".studio-sidebar-resizer"), "Estilos do redimensionador do Studio definidos");
  assert.ok(popoversCss.includes("top: calc(100% + 4px)"), "Posicionamento relativo dinâmico nos menus superiores");
  assert.ok(popoversCss.includes("bottom: calc(100% + 6px)"), "Posicionamento relativo dinâmico nos menus inferiores");
});

test("Padrão de Ícones: nenhum emoji nas interfaces de chat e menus", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  // Verifica nos blocos de menus de dialogs-chat
  const chatMenusMatch = chatHtml.match(/<div class="chat-dropdown-menu"[\s\S]*?<\/div>/);
  if (chatMenusMatch) {
    assert.equal(emojiRegex.test(chatMenusMatch[0]), false, "Sem emojis em chatMenus");
  }
  const studioMenusMatch = studioHtml.match(/<div class="chat-dropdown-menu"[\s\S]*?<\/div>/);
  if (studioMenusMatch) {
    assert.equal(emojiRegex.test(studioMenusMatch[0]), false, "Sem emojis em studioMenus");
  }
});

test("Studio: divisor suporta ponteiro, teclado, limites e persistência acessível", () => {
  const studioResizerSource = studioCoreJs + studioLayoutJs;
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?role="separator"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?tabindex="0"/);
  assert.match(studioHtml, /id="studioSidebarResizer"[\s\S]*?aria-controls="studioSidebar"/);
  assert.match(studioResizerSource, /addEventListener\("pointerdown"/);
  assert.match(studioResizerSource, /addEventListener\("pointermove"/);
  assert.match(studioResizerSource, /addEventListener\("keydown"/);
  assert.match(studioResizerSource, /"ArrowLeft"/);
  assert.match(studioResizerSource, /"ArrowRight"/);
  assert.match(studioResizerSource, /"Home"/);
  assert.match(studioResizerSource, /"End"/);
  assert.match(studioResizerSource, /aria-valuenow/);
  assert.match(studioResizerSource, /harness_studio_sidebar_width/);
  assert.doesNotMatch(studioResizerSource, /addEventListener\("mousedown"/);
});

test("Chat e Studio usam um contrato declarativo comum para menus", () => {
  assert.match(presentationsJs, /export const CHAT_PRESENTATIONS/);
  assert.match(presentationsJs, /main: Object\.freeze/);
  assert.match(presentationsJs, /studio: Object\.freeze/);
  assert.match(interactionJs, /allChatMenuIds\(\)/);
  assert.match(interactionJs, /chatMenuId\("main", "provider"\)/);
  assert.match(interactionJs, /chatMenuId\("studio", "provider"\)/);
  assert.doesNotMatch(interactionJs, /const menuIds = \[/);
});

test("Cada apresentação envia diretamente do próprio compositor", () => {
  assert.match(presentationsJs, /mini: Object\.freeze/);
  assert.match(sendJs, /sendChatMessage\(presentation = "main"\)/);
  assert.match(sendJs, /chatPresentation\(presentation\)\.input/);
  assert.match(studioCompanionJs, /sendChatMessage\("studio"\)/);
  assert.match(miniJs, /sendChatMessage\("mini"\)/);
  assert.match(enginesJs, /applyDaiWorkflow\(wfId, presentation/);
  assert.doesNotMatch(studioCompanionJs, /mainInp/);
  assert.doesNotMatch(miniJs, /mainInp\.value = input\.value/);
});

test("Sessões dos motores são isoladas por projeto e conversa", () => {
  assert.match(sessionsJs, /chatSessionKey\(slug, chatId\)/);
  assert.match(sessionsJs, /sessionsByChat = new Map\(\)/);
  assert.match(sessionsJs, /String\(slug \|\| "global"\)\.toLowerCase\(\)/);
  assert.match(sessionsJs, /chatId \|\| "draft"/);
  assert.match(sessionsJs, /moveEngineSessions\(slug, fromChatId, toChatId\)/);
  assert.match(sendJs, /getEngineSession\(P\.slug, chatId/);
  assert.match(sendJs, /setEngineSession\(P\.slug, chatId/);
  assert.match(persistJs, /activateEngineSessions\(P\.slug, chatName\)/);
  assert.match(persistJs, /moveEngineSessions\(P\.slug, cs\.currentChatFile, data\.fileName\)/);
  assert.match(persistJs, /state\.currentChatFile = chatName/);
  assert.doesNotMatch(sendJs, /cs\.engineSessions\[/);
  assert.doesNotMatch(persistJs, /cs\.engineSessions\[/);
});

test("Store de sessões não vaza IDs e migra draft para o arquivo salvo", async () => {
  const executableSource = sessionsJs.replace(
    'import { cs } from "./chat-store.js";',
    "const cs = { engineSessions: {} };"
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(executableSource).toString("base64")}`;
  const store = await import(moduleUrl);

  store.setEngineSession("projeto-a", null, "claude", "sessao-draft-a");
  store.setEngineSession("projeto-b", null, "claude", "sessao-draft-b");
  assert.equal(store.getEngineSession("projeto-a", null, "claude"), "sessao-draft-a");
  assert.equal(store.getEngineSession("projeto-b", null, "claude"), "sessao-draft-b");

  store.moveEngineSessions("projeto-a", null, "chat-a.md");
  assert.equal(store.getEngineSession("projeto-a", "chat-a.md", "claude"), "sessao-draft-a");
  assert.equal(store.getEngineSession("projeto-a", null, "claude"), null);

  store.setEngineSession("projeto-a", "chat-b.md", "gemini", "sessao-b");
  assert.equal(store.getEngineSession("projeto-a", "chat-a.md", "gemini"), null);
  assert.equal(store.getEngineSession("projeto-a", "chat-b.md", "gemini"), "sessao-b");
});

test("Cancelamento de streaming e isolado por projeto e conversa", async () => {
  const executableSource = executionsJs.replace(
      'import { chatSessionKey } from "./chat-session-store.js";',
      'const chatSessionKey = (slug, chatId) => `${String(slug || "global").toLowerCase()}::${chatId || "draft"}`;'
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(executableSource).toString("base64")}`;
  const store = await import(moduleUrl);
  const aborted = { a: 0, b: 0, project: 0 };

  store.setChatStreaming("projeto-a", "chat-a.md", true);
  store.setChatAbortController("projeto-a", "chat-a.md", "claude", { abort: () => aborted.a++ });
  store.setChatStreaming("projeto-a", "chat-b.md", true);
  store.setChatAbortController("projeto-a", "chat-b.md", "claude", { abort: () => aborted.b++ });
  store.setChatStreaming("projeto-b", "chat-a.md", true);
  store.setChatAbortController("projeto-b", "chat-a.md", "claude", { abort: () => aborted.project++ });

  store.cancelChatExecution("projeto-a", "chat-a.md");
  assert.deepEqual(aborted, { a: 1, b: 0, project: 0 });
  assert.equal(store.isChatStreamingFor("projeto-a", "chat-a.md"), false);
  assert.equal(store.isChatStreamingFor("projeto-a", "chat-b.md"), true);
  assert.equal(store.isChatStreamingFor("projeto-b", "chat-a.md"), true);
});

test("Envio e cancelamento nao dependem de AbortController global", () => {
  assert.match(sendJs, /const chatId = cs\.currentChatFile/);
  assert.match(sendJs, /isChatStreamingFor\(P\.slug, chatId\)/);
  assert.match(streamUiJs, /cancelChatExecution\(P\.slug, cs\.currentChatFile/);
  assert.doesNotMatch(sendJs, /activeAbortControllers/);
  assert.doesNotMatch(streamUiJs, /activeAbortControllers/);
});

test("Estado visual do streaming deriva da conversa ativa", () => {
  assert.match(miniJs, /isChatStreamingFor\(state\.P\.slug, cs\.currentChatFile\)/);
  assert.match(renderJs, /isChatStreamingFor\(state\.P\.slug, cs\.currentChatFile\)/);
  assert.match(streamUiJs, /let chatStreamTimer = null/);
  assert.match(streamUiJs, /activeChatIsStreaming\(\)/);
  assert.doesNotMatch(storeJs, /isChatStreaming/);
  assert.doesNotMatch(storeJs, /chatStreamTimer/);
  assert.doesNotMatch(miniJs, /cs\.isChatStreaming/);
  assert.doesNotMatch(renderJs, /cs\.isChatStreaming/);
});

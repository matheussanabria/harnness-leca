// @ts-check
// chat-ui-interaction.js — Interações de UI, Menus, Popovers e Compositor do Chat
import { $, autoGrow, showToast } from "../shared/dom.js";
import { state, saveChatDraft, getChatDraft } from "../shared/state.js";
import { ENGINES, switchEngine, setEffort, applyDaiWorkflow } from "./chat.js";
import { cs } from "./chat-store.js";
import { allChatMenuIds, chatMenuId, chatPresentation } from "./chat-presentations.js";
import { loadHiaPanel, warnIfLocalInferenceUnsafe } from "./chat-hia-panel.js";

let draftTimer = null;

export function handleChatInput(input) {
  autoGrow(input);
  if (!state.P || !state.P.slug) return;
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    saveChatDraft(state.P.slug, input.value);
  }, 250);
}
export const handleMobileChatInput = handleChatInput;

export function restoreChatDraft(slug) {
  const input = /** @type {HTMLTextAreaElement} */ ($("chatInput"));
  if (!input) return;
  const draft = getChatDraft(slug);
  if (draft && !input.value) {
    input.value = draft;
    autoGrow(input);
  }
}
export const restoreMobileChatDraft = restoreChatDraft;

export function isAnyChatMenuOpen() {
  return allChatMenuIds().some((id) => {
    const el = $(id);
    return el && el.style.display !== "none";
  });
}

export function closeAllChatMenus() {
  allChatMenuIds().forEach((id) => {
    const el = $(id);
    if (el) el.style.display = "none";
  });
}

function toggleMenu(menuId, force) {
  const el = $(menuId);
  if (!el) return;
  const isOpen = el.style.display !== "none";
  const next = typeof force === "boolean" ? force : !isOpen;
  closeAllChatMenus();
  if (next) el.style.display = "block";
}

export function toggleProviderDropdown(force) {
  toggleMenu(chatMenuId("main", "provider"), force);
}

export function selectProvider(engine) {
  closeAllChatMenus();
  switchEngine(engine);
  updateChatHeaderAndPills();
  // Motor local: avisa se a máquina não tem RAM livre para carregar o modelo.
  if (engine === "ollama") warnIfLocalInferenceUnsafe();
}
export const selectClaudeEngine = selectProvider;

export function toggleCompareMode() {
  closeAllChatMenus();
  if (cs.currentEngine === "compare") {
    switchEngine(cs.lastSingleEngine || "claude");
  } else {
    cs.lastSingleEngine = cs.currentEngine || "claude";
    switchEngine("compare");
  }
  updateChatHeaderAndPills();
}

export function toggleChatMoreMenu(force) {
  toggleMenu(chatMenuId("main", "more"), force);
}

export function toggleChatSettingsPopover(force) {
  toggleMenu(chatMenuId("main", "settings"), force);
  const el = $(chatMenuId("main", "settings"));
  if (el && el.style.display !== "none") loadHiaPanel("hiaMetricsContainer");
}
export const toggleClaudeModelSheet = toggleChatSettingsPopover;

export function toggleComposerAddMenu(force) {
  toggleMenu(chatMenuId("main", "attachments"), force);
}
export const toggleClaudeAddSheet = toggleComposerAddMenu;

export function toggleComposerToolsMenu(force) {
  toggleMenu(chatMenuId("main", "tools"), force);
}

export function applyQuickAction(actionId) {
  closeAllChatMenus();
  applyDaiWorkflow(actionId, "main");
  showToast("Ação rápida aplicada no compositor");
}

export function applySuggestedPrompt(text) {
  const inp = /** @type {HTMLTextAreaElement} */ ($("chatInput"));
  if (!inp) return;
  inp.value = text;
  inp.focus();
  autoGrow(inp);
}

export function handleChatHistoryScroll(container) {
  if (!container) return;
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  let btnId = "chatScrollBottomBtn";
  if (container.id === "studioChatHistory") {
    btnId = "studioChatScrollBottomBtn";
  } else if (container.id === "miniChatHistory") {
    btnId = "miniChatScrollBtn";
  }
  const btn = $(btnId);
  if (btn) btn.style.display = isNearBottom ? "none" : "flex";
}

export function scrollChatToBottom(presentation = "main") {
  const p = chatPresentation(presentation);
  const hist = $(p.history);
  if (hist) {
    hist.scrollTo({ top: hist.scrollHeight, behavior: "smooth" });
  }
  const btn = $(p.scrollButton);
  if (btn) btn.style.display = "none";
}

export function scrollStudioChatToBottom() {
  scrollChatToBottom("studio");
}

export function scrollMiniChatToBottom() {
  scrollChatToBottom("mini");
}

export function toggleStudioProviderDropdown(force) {
  toggleMenu(chatMenuId("studio", "provider"), force);
}

export function toggleStudioChatMoreMenu(force) {
  toggleMenu(chatMenuId("studio", "more"), force);
}

export function toggleStudioChatSettingsPopover(force) {
  toggleMenu(chatMenuId("studio", "settings"), force);
}

export function toggleStudioComposerAddMenu(force) {
  toggleMenu(chatMenuId("studio", "attachments"), force);
}

export function toggleStudioComposerToolsMenu(force) {
  toggleMenu(chatMenuId("studio", "tools"), force);
}

export function handleStudioChatInput(input) {
  autoGrow(input);
}

export function applyStudioQuickAction(actionId) {
  closeAllChatMenus();
  applyDaiWorkflow(actionId, "studio");
  showToast("Ação rápida aplicada no Studio");
}

export function updateChatHeaderAndPills() {
  const curEng = cs.currentEngine || state.currentEngine || "claude";
  const engInfo = ENGINES[curEng] || { name: curEng, color: "#d97757" };
  const displayName = curEng === "compare" ? "Comparar" : engInfo.name;

  const pName = $("chatProviderName");
  if (pName) pName.textContent = displayName;
  const sName = $("studioProviderName");
  if (sName) sName.textContent = displayName;

  const icons = {
    claude: '<i class="fa-solid fa-asterisk" style="color:#d97757"></i>',
    opencode: '<i class="fa-solid fa-code" style="color:#3cb371"></i>',
    gemini: '<i class="fa-solid fa-gem" style="color:#5c87f2"></i>',
    codex: '<i class="fa-solid fa-terminal" style="color:#10a37f"></i>',
    ollama: '<i class="fa-solid fa-microchip" style="color:#e06c75"></i>',
    compare: '<i class="fa-solid fa-code-compare" style="color:#a78bfa"></i>',
  };
  const iconHtml = icons[curEng] || '<i class="fa-solid fa-robot"></i>';

  const pIcon = $("chatProviderIcon");
  if (pIcon) pIcon.innerHTML = iconHtml;
  const sIcon = $("studioProviderIcon");
  if (sIcon) sIcon.innerHTML = iconHtml;

  const cmpBtn = $("btnToggleCompareMode");
  if (cmpBtn) cmpBtn.classList.toggle("active", curEng === "compare");
  const sCmpBtn = $("btnToggleStudioCompareMode");
  if (sCmpBtn) sCmpBtn.classList.toggle("active", curEng === "compare");

  const pSlug = (state.P && state.P.slug) || "Projeto";
  const titleEl = $("chatTitle");
  if (titleEl) titleEl.textContent = `Chat · ${pSlug}`;

  // Atualiza botões ativos nos menus de provedores
  document.querySelectorAll("#providerDropdownMenu .dropdown-item[data-eng], #studioProviderDropdownMenu .dropdown-item[data-eng]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-eng") === curEng);
  });
}
export const updateClaudeBottomPills = updateChatHeaderAndPills;
export const updateMobileChatHeader = updateChatHeaderAndPills;

// Fecha popovers ao pressionar Escape sem fechar o diálogo pai
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && isAnyChatMenuOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeAllChatMenus();
    }
  },
  true
);

// Fecha popovers ao clicar fora
document.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  if (!target) return;
  if (
    target.closest(".chat-provider-wrap") ||
    target.closest(".chat-more-wrap") ||
    target.closest(".context-settings-wrap") ||
    target.closest(".composer-popover-wrap")
  ) {
    return;
  }
  closeAllChatMenus();
});

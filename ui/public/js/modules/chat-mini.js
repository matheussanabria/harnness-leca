// @ts-check
// Mini widget do chat e controle da janela (minimizar, fechar, restaurar).
import { $ } from "../shared/dom.js";
import { state, saveActiveChatState } from "../shared/state.js";
import { ENGINES, cs } from "./chat-store.js";
import { openInteractiveChat } from "./chat-stream-ui.js";
import { isChatStreamingFor } from "./chat-execution-store.js";
import { setPanelCollapsed } from "./prototype-workspace-layout.js";
import { attachStudioSidebarToAtelier, isSidebarInAtelier } from "./prototype-atelier-sidebar.js";

export function scheduleDebouncedChatSave() {
  if (cs.chatSaveDebounceTimer) clearTimeout(cs.chatSaveDebounceTimer);
  cs.chatSaveDebounceTimer = setTimeout(() => {
    saveActiveChatState();
  }, 400);
}

export function updateMiniChatWidget() {
  const widget = $("miniChatWidget");
  if (!widget) return;

  const dlg = /** @type {any} */ ($("chatDlg"));
  const isModalOpen = Boolean(dlg?.open);
  const minimized = document.body.classList.contains("studio-chat-minimized");
  // Visível no Studio só com o modo ativo; dentro do Ateliê vale a posição real do painel.
  const inStudio = state.isStudioMode && document.body.classList.contains("studio-active");
  const isSidebarVisible = Boolean($("studioSidebar")) && !minimized && (inStudio || isSidebarInAtelier());
  if (isModalOpen || isSidebarVisible || !state.chatTurns.length || cs.isMiniChatDismissed) {
    widget.style.display = "none";
    return;
  }

  widget.style.display = "flex";
  const isStreaming = Boolean(state.P && isChatStreamingFor(state.P.slug, cs.currentChatFile));

  const eng = ENGINES[cs.currentEngine] || { name: "Claude Code", color: "#d97757" };
  const badge = $("miniChatEngineBadge");
  if (badge) {
    const icons = {
      claude: '<i class="fa-solid fa-asterisk"></i>',
      opencode: '<i class="fa-solid fa-code"></i>',
      gemini: '<i class="fa-solid fa-gem"></i>',
      codex: '<i class="fa-solid fa-terminal"></i>',
      compare: '<i class="fa-solid fa-code-compare"></i>',
    };
    if (cs.currentEngine === "compare") {
      badge.innerHTML = '<i class="fa-solid fa-code-compare"></i> Comparação';
      badge.style.color = "#8b5cf6";
      badge.style.borderColor = "#8b5cf655";
      badge.style.background = "#8b5cf615";
    } else {
      const ico = icons[cs.currentEngine] || '<i class="fa-solid fa-robot"></i>';
      badge.innerHTML = `${ico} ${eng.name || "IA"}`;
      badge.style.color = eng.color;
      badge.style.borderColor = `${eng.color}55`;
      badge.style.background = `${eng.color}15`;
    }
  }

  const titleEl = $("miniChatTitle");
  if (titleEl) {
    titleEl.textContent = cs.currentChatTitle || (state.P ? state.P.slug : "Chat Ativo");
  }

  const dot = $("miniChatDot");
  if (dot) {
    dot.className = "mini-chat-dot" + (isStreaming ? " streaming" : "");
    if (isStreaming) {
      dot.style.background = eng.color || "var(--accent)";
    } else {
      dot.style.background = "#3cb371";
    }
  }

  const stBadge = $("miniChatStatusBadge");
  if (stBadge) {
    if (isStreaming) {
      stBadge.textContent = "Respondendo...";
      stBadge.style.color = "var(--accent)";
    } else {
      const userCount = state.chatTurns.filter((t) => t.role === "user").length;
      stBadge.textContent = `${userCount} msg${userCount === 1 ? "" : "s"}`;
      stBadge.style.color = "var(--mute)";
    }
  }

  const preview = $("miniChatPreviewText");
  const streamInd = $("miniChatStreamIndicator");
  const streamTxt = $("miniChatStreamText");

  if (isStreaming) {
    if (streamInd) streamInd.style.display = "flex";
    if (streamTxt) {
      const last = state.chatTurns[state.chatTurns.length - 1];
      const previewSlice = last && last.text ? last.text.slice(-50) : "Processando resposta...";
      streamTxt.textContent = previewSlice;
    }
    if (preview) preview.style.display = "none";
  } else {
    if (streamInd) streamInd.style.display = "none";
    if (preview) {
      preview.style.display = "-webkit-box";
      const last = state.chatTurns[state.chatTurns.length - 1];
      if (last) {
        let snippet = "";
        let who = "";
        if (last.role === "user") {
          who = "Você: ";
          snippet = last.text || "";
        } else if (last.role === "assistant") {
          who = (eng.name || "IA") + ": ";
          snippet = last.text || "";
        } else if (last.role === "comparison") {
          who = "Comparação: ";
          const firstEng = Object.keys(last.responses || {})[0];
          snippet = firstEng && last.responses[firstEng] ? last.responses[firstEng].text : "Multi-motor";
        }
        snippet = snippet.replace(/[\r\n]+/g, " ").trim();
        preview.textContent = who + (snippet.slice(0, 90) || "Sem conteúdo") + (snippet.length > 90 ? "..." : "");
      } else {
        preview.textContent = "Conversa ativa. Clique para reabrir.";
      }
    }
  }

}

export function showMiniChatWidget() {
  cs.isMiniChatDismissed = false;
  updateMiniChatWidget();
}

export function hideMiniChatWidget() {
  const widget = $("miniChatWidget");
  if (widget) widget.style.display = "none";
}

export function dismissMiniChat() {
  cs.isMiniChatDismissed = true;
  hideMiniChatWidget();
}

export function minimizeCurrentChat(origin = "") {
  const host = $("atelierChatHost");
  const inAtelier = host && host.contains($("studioSidebar"));
  // O chat reutilizado dentro do Ateliê tem prioridade: o cabeçalho dele chama com origem "studio".
  const detectedOrigin = inAtelier ? "atelier" : origin || (state.isStudioMode ? "studio" : "dialog");

  cs.miniChatOrigin = detectedOrigin;

  if (detectedOrigin === "atelier") {
    const root = $("protoWorkspaceRoot");
    if (root) setPanelCollapsed(root, "chat", true);
    document.body.classList.add("studio-chat-minimized");
  } else if (detectedOrigin === "studio") {
    document.body.classList.add("studio-chat-minimized");
  } else {
    const dlg = /** @type {any} */ ($("chatDlg"));
    if (dlg && dlg.open) dlg.close();
  }
  showMiniChatWidget();
}

export function minimizeChatModal() {
  minimizeCurrentChat();
}

export function closeChatModal() {
  localStorage.removeItem("harness_chat_open");
  const dlg = /** @type {any} */ ($("chatDlg"));
  if (dlg && dlg.open) dlg.close();
  if (state.chatTurns.length > 0) {
    showMiniChatWidget();
  }
}

export function restoreChatFromMini() {
  hideMiniChatWidget();
  const origin = cs.miniChatOrigin || "dialog";

  if (origin === "atelier") {
    document.body.classList.remove("studio-chat-minimized");
    const root = $("protoWorkspaceRoot");
    if (root) setPanelCollapsed(root, "chat", false);
    attachStudioSidebarToAtelier();
  } else if (origin === "studio") {
    document.body.classList.remove("studio-chat-minimized");
  } else {
    openInteractiveChat();
  }
}

export function restoreChatToStudio() {
  hideMiniChatWidget();
  document.body.classList.remove("studio-chat-minimized");
  if (window.toggleStudioMode) window.toggleStudioMode(true);
}

export function toggleMiniWidgetExpand(e) {
  if (e) e.stopPropagation();
  const widget = $("miniChatWidget");
  if (!widget) return;
  const isExpanded = widget.classList.toggle("expanded");
  const expBody = $("miniChatExpandedBody");
  const expBtn = $("btnMiniChatExpand");
  if (expBody) expBody.style.display = isExpanded ? "flex" : "none";
  if (expBtn) expBtn.innerHTML = isExpanded ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
  if (isExpanded) {
    if (window.renderChatHistory) window.renderChatHistory();
    const inp = $("miniChatInput");
    const mainInp = /** @type {HTMLInputElement} */ ($("chatInput"));
    if (inp && mainInp && !inp.value) inp.value = mainInp.value;
    if (inp) inp.focus();
  }
}

export function handleMiniChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMiniChatMessage();
  }
}

export function handleMiniChatInput(input) {
  if (window.handleChatInput) window.handleChatInput(input);
}

export function sendMiniChatMessage() {
  const inp = /** @type {HTMLInputElement} */ ($("miniChatInput"));
  if (!inp) return;
  if (!inp.value.trim()) return;
  if (window.sendChatMessage) window.sendChatMessage("mini");
}

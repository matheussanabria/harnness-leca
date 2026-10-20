// @ts-check
import { $, esc, clean, fmt, autoGrow, copyToClipboard, showToast, section, openDlg } from "./shared/dom.js";
import { md, parseChat, renderChat, parseFrontmatter } from "./shared/markdown.js";
import { state, GROUP_PALETTE, getActiveChatStorageKey, saveActiveChatState, restoreActiveChatState, clearActiveChatState } from "./shared/state.js";
import { projectSelection } from "./shared/project-selection.js";
import * as groupsMod from "./modules/groups.js";
import * as projectsMod from "./modules/projects.js";
import * as reviewMod from "./modules/review.js";
import * as skillsMod from "./modules/skills.js";
import * as servicesMod from "./modules/services.js";
import * as studioMod from "./modules/studio.js";
import * as chatMod from "./modules/chat.js";
import * as inspectorMod from "./modules/inspector.js";
import * as designMod from "./modules/design.js";
import * as mobileChatMod from "./modules/mobile-chat.js";
import * as chatAttachMod from "./modules/chat-attachments.js";
import * as chatCodeActionsMod from "./modules/chat-code-actions.js";

// Exporta todas as funções para o escopo global (window)
// para compatibilidade com os manipuladores onclick/oninput inline no HTML
Object.assign(window, {
  $,
  esc,
  clean,
  fmt,
  autoGrow,
  copyToClipboard,
  showToast,
  section,
  openDlg,
  md,
  parseChat,
  renderChat,
  parseFrontmatter,
  state,
  GROUP_PALETTE,
  getActiveChatStorageKey,
  saveActiveChatState,
  restoreActiveChatState,
  clearActiveChatState,
  // Groups
  ...groupsMod,
  // Projects
  ...projectsMod,
  // Review
  ...reviewMod,
  // Skills
  ...skillsMod,
  // Services
  ...servicesMod,
  // Studio
  ...studioMod,
  // Chat
  ...chatMod,
  // Inspector
  ...inspectorMod,
  // Design
  ...designMod,
  // Mobile Chat
  ...mobileChatMod,
  // Anexos do chat
  ...chatAttachMod,
  // Ações de código
  ...chatCodeActionsMod,
});

// Inicialização da Aplicação
(async () => {
  const urlParams = new URLSearchParams(location.search);
  const pinFromUrl = urlParams.get("pin");
  if (pinFromUrl) {
    localStorage.setItem("harness_pin", pinFromUrl);
  }

  await chatMod.initEngines();
  await chatMod.initDai();

  const S = await (await fetch("/api/state")).json();
  state.S = S;
  // @ts-ignore
  window.S = S;

  const sel = /** @type {HTMLSelectElement} */ ($("sel"));
  if (sel) {
    sel.innerHTML = S.projects.map((p) => `<option ${p === S.active ? "selected" : ""}>${esc(p)}</option>`).join("");
  }

  if (!S.projects.length) {
    $("title").textContent = "Nenhum projeto ainda";
    $("meta").textContent = "veja o passo 4 do SETUP.md";
    $("chats").innerHTML =
      '<p class="empty">Crie um projeto copiando projects/_template ou importe conversas com tools/import-claude-code-chats.js.</p>';
    return;
  }

  // /?p=slug abre o projeto indicado; se não vier na URL, restaura do localStorage ou do ativo.
  const start = await projectSelection.initialize({ projects: S.projects, serverActive: S.active });
  state.S.active = start;
  if (sel) {
    sel.value = start;
    sel.onchange = async (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      select.disabled = true;
      try {
        const selected = await projectSelection.select(select.value);
        state.S.active = selected;
        await projectsMod.load(selected);
      } catch (error) {
        select.value = projectSelection.activeProject;
        showToast(error instanceof Error ? error.message : "Não foi possível trocar de projeto.");
      } finally {
        select.disabled = false;
      }
    };
  }
  await projectsMod.load(start);

  const chatFromUrl = urlParams.get("chat");
  if (chatFromUrl) await chatMod.resumeExistingChat(chatFromUrl, false);

  // Inicializa módulo e view contextual se especificados na URL
  const wantModule = urlParams.get("module");
  const wantView = urlParams.get("view");
  if (wantModule === "design" || wantView) {
    await designMod.toggleDesignMode(true, wantView || "scrum");
  } else if (wantModule === "studio") {
    await studioMod.toggleStudioMode(true);
  }

  // Link de sincronização entre o objeto state.P e window.P para módulos legados
  Object.defineProperty(window, "P", {
    get: () => state.P,
    set: (val) => {
      state.P = val;
    },
    configurable: true,
  });

  const chatDlgEl = $("chatDlg");
  if (chatDlgEl) {
    chatDlgEl.addEventListener("close", () => {
      if (state.chatTurns.length > 0 && !state.isStudioMode) {
        chatMod.updateMiniChatWidget();
      }
    });
  }

  // Permite fechar qualquer modal ao clicar fora dele (no backdrop)
  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      // No <dialog>, o backdrop tem o próprio elemento como target. Testar
      // coordenadas fecha o modal em cliques programáticos, como input.click().
      if (e.target === d) {
        try {
          d.close();
        } catch {}
      }
    });
  });

  // Tecla Escape fecha qualquer diálogo aberto
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll("dialog[open]").forEach((d) => {
        try {
          /** @type {HTMLDialogElement} */ (d).close();
        } catch {}
      });
    } else if (e.altKey && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      if (typeof window.toggleInspectorMode === "function") {
        window.toggleInspectorMode();
      }
    }
  });
})();

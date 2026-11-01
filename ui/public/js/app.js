// @ts-check
import { $, esc, clean, fmt, autoGrow, copyToClipboard, showToast, section, openDlg } from "./shared/dom.js";
import { md, parseChat, renderChat, parseFrontmatter } from "./shared/markdown.js";
import { state, GROUP_PALETTE, getActiveChatStorageKey, saveActiveChatState, restoreActiveChatState, clearActiveChatState } from "./shared/state.js";
import { projectSelection } from "./shared/project-selection.js";
import { createScreenStateClient } from "./shared/screen-state.js";
import { hydratePageSizes } from "./shared/pagination-prefs.js";
import { guardUnsavedTransition } from "./shared/unsaved-dialog.js";
import { unsavedChanges } from "./shared/unsaved-changes.js";
import * as groupsMod from "./modules/groups.js";
import * as projectsMod from "./modules/projects.js";
import * as reviewMod from "./modules/review.js";
import * as skillsMod from "./modules/skills.js";
import * as servicesMod from "./modules/services.js";
import * as studioMod from "./modules/studio.js";
import * as chatMod from "./modules/chat.js";
import * as inspectorMod from "./modules/inspector.js";
import * as designMod from "./modules/design.js";
import { restoredDesignState } from "./modules/design-view-state.js";
import { getRouter, routeFromLocation } from "./shared/router.js";
import { createRouteApplier } from "./modules/route-apply.js";
import { getIslandLoader } from "./shared/island-loader.js";
import { persistAtelierActive } from "./modules/prototype-atelier-adoption.js";
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
  // Versões antigas guardavam o PIN em texto puro aqui; a sessão agora é um cookie HttpOnly.
  try { localStorage.removeItem("harness_pin"); } catch { /* armazenamento indisponível */ }

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
        const selected = await guardUnsavedTransition(async ({ force }) => {
          const next = await projectSelection.select(select.value, { force });
          state.S.active = next;
          await projectsMod.load(next);
          return next;
        }, {
          title: "Trocar de projeto",
          message: "Há alterações não salvas no Studio. Como deseja continuar?",
          save: typeof globalThis.saveStudioSourceFile === "function"
            ? () => globalThis.saveStudioSourceFile()
            : undefined,
          clear: (id) => unsavedChanges.clear(id)
        });
        if (!selected) select.value = projectSelection.activeProject;
      } catch (error) {
        select.value = projectSelection.activeProject;
        showToast(error instanceof Error ? error.message : "Não foi possível trocar de projeto.");
      } finally {
        select.disabled = false;
      }
    };
  }
  await projectsMod.load(start);

  const projectClient = createScreenStateClient({ project: start });
  await chatMod.hydrateEngineSettings({ client: projectClient });
  await skillsMod.hydrateSkillsState({ client: projectClient });
  await hydratePageSizes();

  const chatFromUrl = urlParams.get("chat");
  if (chatFromUrl) await chatMod.resumeExistingChat(chatFromUrl, false);

  // A hash route (#/scrum, #/prototypes/<id>/<screen>) or an old ?view= / ?module= link decides the screen;
  // without either, the saved state is used (F5 on a screen that has not reported its route yet).
  const applyRoute = createRouteApplier({
    designMod, studioMod, prepareAtelier: persistAtelierActive,
    islands: getIslandLoader() || undefined, getSlug: () => projectSelection.activeProject,
  });
  const route = routeFromLocation(location);
  if (route) {
    await applyRoute(route);
  } else if (!urlParams.get("module")) {
    const savedDesign = await restoredDesignState();
    if (savedDesign.open) await designMod.toggleDesignMode(true, savedDesign.view);
  }
  // Back/Forward and a hand-edited hash open the screen they point to.
  getRouter()?.onChange((next) => { void applyRoute(next); });

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

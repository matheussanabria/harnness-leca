// @ts-check
// Move o chat do Studio para dentro do Ateliê sem perder o painel em re-renders.
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";

/** @type {HTMLElement | null} */
let sidebarRef = null;

function findSidebar() {
  if (!sidebarRef) sidebarRef = /** @type {HTMLElement} */ ($("studioSidebar"));
  return sidebarRef;
}

/** Guarda o chat fora do Ateliê (no Studio, ou num depósito oculto) sem mexer em modo nem em classes do body. */
export function parkStudioSidebar() {
  const sidebar = findSidebar();
  if (!sidebar) return;
  let target = $("studioWorkspace");
  if (!target) {
    target = document.getElementById("studioSidebarParking");
    if (!target) {
      target = document.createElement("div");
      target.id = "studioSidebarParking";
      target.hidden = true;
      document.body.appendChild(target);
    }
  }
  if (sidebar.parentElement !== target) target.prepend(sidebar);
}

export function isSidebarInAtelier() {
  const host = $("atelierChatHost");
  const sidebar = findSidebar();
  return Boolean(host && sidebar && host.contains(sidebar));
}

export function attachStudioSidebarToAtelier() {
  const host = $("atelierChatHost");
  const sidebar = findSidebar();
  if (!host || !sidebar) return;
  // appendChild reanexa até um nó que tenha sobrado fora do documento.
  host.appendChild(sidebar);
  // O chat está ativo aqui mesmo quando o Ateliê abre fora do Studio (aba Design).
  state.isStudioMode = true;
  // O recolhimento é persistido: reaplica o estado minimizado ao reabrir o Ateliê.
  const collapsed = Boolean(document.querySelector(".proto-col-chat.collapsed"));
  document.body.classList.toggle("studio-chat-minimized", collapsed);
  window.updateMiniChatWidget?.();
  if (window.syncStudioControls) window.syncStudioControls();
  if (window.renderChatHistory) window.renderChatHistory();
  if (window.updateEngineAuthBadge) window.updateEngineAuthBadge();
}

export function detachStudioSidebarFromAtelier() {
  parkStudioSidebar();
  // O minimizado do Ateliê não pode vazar para o Studio nem para o painel.
  document.body.classList.remove("studio-chat-minimized");
  // Voltando do Ateliê: o modo Studio só fica ligado se o body estiver em studio-active.
  state.isStudioMode = document.body.classList.contains("studio-active");
}

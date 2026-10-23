// @ts-check
// Terceira coluna do Studio (chat | preview | código-fonte): abrir/fechar e redimensionar.
import { $ } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { saveStudioState } from "./studio-state.js";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 320;
const MIN_PREVIEW = 280;

let pendingWidth = null;
let pendingProject = "";

function rememberWidth(width) {
  pendingWidth = width;
  pendingProject = state.activeProject || "";
}

function currentPendingWidth() {
  return pendingProject === (state.activeProject || "") ? pendingWidth : null;
}

export function isStudioSourceColumnOpen() {
  return document.body.classList.contains("studio-source-open");
}

export function getStoredSourceColumnOpen() {
  return false;
}

/** @param {number} width */
function clampWidth(width) {
  const ws = $("studioWorkspace");
  const sidebar = document.body.classList.contains("studio-chat-minimized") ? 0 : $("studioSidebar")?.offsetWidth || 0;
  const room = (ws?.clientWidth || window.innerWidth) - sidebar - MIN_PREVIEW;
  return Math.max(MIN_WIDTH, Math.min(Math.round(width), room));
}

/** @param {number} width @param {boolean} [persist] */
function applyWidth(width, persist = false) {
  const pane = $("studioSourceWorkspace");
  if (!pane) return;
  const next = clampWidth(width);
  rememberWidth(next);
  pane.style.width = `${next}px`;
  pane.style.flex = `0 0 ${next}px`;
  if (persist) {
    void saveStudioState({ sourceWidth: next });
  }
}

/**
 * Aplica a largura vinda do estado da tela (durante a restauração).
 * @param {number} width
 */
export function setStudioSourceColumnWidth(width) {
  rememberWidth(width);
  applyWidth(width);
}

function bindResizer(resizer) {
  let startX = 0;
  let startW = 0;
  let pointerId = null;
  resizer.addEventListener("pointerdown", (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    startX = e.clientX;
    startW = $("studioSourceWorkspace")?.offsetWidth || DEFAULT_WIDTH;
    document.body.classList.add("studio-resizing");
    resizer.setPointerCapture?.(e.pointerId);
  });
  resizer.addEventListener("pointermove", (/** @type {PointerEvent} */ e) => {
    if (pointerId !== e.pointerId) return;
    applyWidth(startW - (e.clientX - startX));
  });
  const stop = (/** @type {PointerEvent} */ e) => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    document.body.classList.remove("studio-resizing");
    resizer.releasePointerCapture?.(e.pointerId);
    applyWidth($("studioSourceWorkspace")?.offsetWidth || startW, true);
  };
  resizer.addEventListener("pointerup", stop);
  resizer.addEventListener("pointercancel", stop);
  resizer.addEventListener("dblclick", () => applyWidth(DEFAULT_WIDTH, true));
}

/** Cria o separador à esquerda da coluna de código, uma única vez. */
export function ensureSourceColumnResizer() {
  const pane = $("studioSourceWorkspace");
  if (!pane || $("studioSourceResizer")) return;
  const resizer = document.createElement("div");
  resizer.id = "studioSourceResizer";
  resizer.className = "studio-sidebar-resizer studio-source-resizer";
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-label", "Redimensionar coluna de código");
  resizer.title = "Arraste para redimensionar; duplo clique restaura";
  pane.before(resizer);
  bindResizer(resizer);
}

/**
 * Abre ou fecha a coluna de código sem alterar o modo do preview.
 * @param {boolean} open
 */
export function setStudioSourceColumn(open) {
  const appWindow = /** @type {any} */ (window);
  document.body.classList.toggle("studio-source-open", open);
  void saveStudioState({ sourceOpen: open });
  $("btnViewSource")?.classList.toggle("active", open);
  $("btnDrawerSource")?.classList.toggle("active", open);
  if (!open) return;
  Promise.resolve(appWindow.loadStudioSourceWorkspace?.()).then(() => {
    ensureSourceColumnResizer();
    applyWidth(currentPendingWidth() ?? DEFAULT_WIDTH);
  });
}

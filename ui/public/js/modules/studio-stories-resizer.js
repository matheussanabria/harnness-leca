// @ts-check
// Drag resizer for the Studio stories column (left edge). Width lives in memory for the page session;
// double click restores the default. Keyboard: arrows resize, Home restores.
import { $ } from "../shared/dom.js";

const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 320;
const MIN_PREVIEW = 280;
const KEY_STEP = 24;

/** @param {number} width */
function clamp(width) {
  const ws = $("studioWorkspace");
  const sidebar = document.body.classList.contains("studio-chat-minimized") ? 0 : $("studioSidebar")?.offsetWidth || 0;
  const others = $("studioSourceWorkspace")?.offsetWidth || 0;
  const room = (ws?.clientWidth || window.innerWidth) - sidebar - others - MIN_PREVIEW;
  return Math.max(MIN_WIDTH, Math.min(Math.round(width), room));
}

/** @param {number} width */
export function applyStoriesWidth(width) {
  const pane = $("studioStoriesWorkspace");
  if (!pane) return;
  const next = clamp(width);
  pane.style.width = `${next}px`;
  pane.style.flex = `0 0 ${next}px`;
  $("studioStoriesResizer")?.setAttribute("aria-valuenow", String(next));
}

/** @param {HTMLElement} resizer */
function bind(resizer) {
  let startX = 0;
  let startW = 0;
  let pointerId = /** @type {number | null} */ (null);
  const current = () => $("studioStoriesWorkspace")?.offsetWidth || DEFAULT_WIDTH;
  resizer.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    startX = e.clientX;
    startW = current();
    document.body.classList.add("studio-resizing");
    resizer.setPointerCapture?.(e.pointerId);
  };
  resizer.onpointermove = (e) => { if (pointerId === e.pointerId) applyStoriesWidth(startW - (e.clientX - startX)); };
  const stop = (/** @type {PointerEvent} */ e) => {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    document.body.classList.remove("studio-resizing");
    resizer.releasePointerCapture?.(e.pointerId);
  };
  resizer.onpointerup = stop;
  resizer.onpointercancel = stop;
  resizer.ondblclick = () => applyStoriesWidth(DEFAULT_WIDTH);
  resizer.onkeydown = (e) => {
    if (e.key === "ArrowLeft") applyStoriesWidth(current() + KEY_STEP);
    else if (e.key === "ArrowRight") applyStoriesWidth(current() - KEY_STEP);
    else if (e.key === "Home") applyStoriesWidth(DEFAULT_WIDTH);
    else return;
    e.preventDefault();
  };
}

/** Creates the separator before the stories column, once. */
export function ensureStoriesResizer() {
  const pane = $("studioStoriesWorkspace");
  if (!pane || $("studioStoriesResizer")) return;
  const resizer = document.createElement("div");
  resizer.id = "studioStoriesResizer";
  resizer.className = "studio-sidebar-resizer studio-stories-resizer";
  resizer.tabIndex = 0;
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-label", "Redimensionar coluna de histórias");
  resizer.setAttribute("aria-valuemin", String(MIN_WIDTH));
  resizer.title = "Arraste para redimensionar; duplo clique restaura";
  pane.before(resizer);
  bind(resizer);
}

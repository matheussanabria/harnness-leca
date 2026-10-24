// @ts-check
// Aba Consumo: controlador. Carrega, desenha, faz polling só com a aba visível e aborta ao sair.

import { loadUsage } from "./usage-api.js";
import { renderUsagePanel } from "./usage-render.js";
import { buildUsageViewModel, DEFAULT_WINDOW, WINDOWS } from "./usage-view-model.js";

export const POLL_MS = 30000;

/** Visível = conectado, documento visível e drawer (quando houver) aberto. */
function defaultIsVisible(root, doc) {
  if (!root || root.isConnected === false || (doc && doc.hidden)) return false;
  const drawer = root.closest ? root.closest(".office-drawer") : null;
  return !(drawer && drawer.classList && !drawer.classList.contains("open"));
}

/**
 * @param {any} root
 * @param {{ slug: string, fetchImpl?: typeof fetch, doc?: any, pollMs?: number, load?: Function,
 *   isVisible?: () => boolean, setIntervalImpl?: Function, clearIntervalImpl?: Function, window?: string }} params
 */
export function mountUsagePanel(root, params) {
  const doc = params.doc !== undefined ? params.doc : (typeof document !== "undefined" ? document : null);
  const load = params.load || loadUsage;
  const isVisible = params.isVisible || (() => defaultIsVisible(root, doc));
  const setIv = params.setIntervalImpl || setInterval;
  const clearIv = params.clearIntervalImpl || clearInterval;
  let win = WINDOWS.some((w) => w.id === params.window) ? /** @type {string} */ (params.window) : DEFAULT_WINDOW;
  let state = /** @type {any} */ ({ status: "loading", window: win });
  let timer = null;
  let controller = null;
  let destroyed = false;
  let seq = 0;

  const draw = (focusSel) => {
    root.innerHTML = renderUsagePanel(state);
    if (focusSel && root.querySelector) {
      const el = root.querySelector(focusSel);
      if (el && el.focus) el.focus();
    }
  };

  const abort = () => { if (controller) { controller.abort(); controller = null; } };

  async function refresh(showLoading = false) {
    if (destroyed) return;
    abort();
    controller = typeof AbortController === "function" ? new AbortController() : null;
    const mine = ++seq;
    if (showLoading || state.status !== "ready") { state = { status: "loading", window: win }; draw(); }
    try {
      const data = await load(params.slug, { window: win, signal: controller ? controller.signal : undefined, fetchImpl: params.fetchImpl });
      if (destroyed || mine !== seq) return;
      state = { status: "ready", window: win, vm: buildUsageViewModel(data) };
    } catch (err) {
      if (destroyed || mine !== seq || (err && err.name === "AbortError")) return;
      state = { status: "error", window: win, error: err && err.message ? err.message : "Não foi possível carregar o consumo." };
    }
    draw();
  }

  const stopTimer = () => { if (timer !== null) { clearIv(timer); timer = null; } };
  const startTimer = () => {
    stopTimer();
    timer = setIv(() => {
      if (destroyed) return;
      if (root.isConnected === false) { destroy(); return; }
      if (isVisible()) refresh(false);
    }, params.pollMs || POLL_MS);
  };

  function onVisibility() {
    if (destroyed) return;
    if (isVisible()) { startTimer(); refresh(false); } else { stopTimer(); abort(); }
  }

  function onClick(ev) {
    const t = ev && ev.target && ev.target.closest ? ev.target : null;
    if (!t) return;
    const w = t.closest("[data-usage-window]");
    if (w) {
      const id = w.getAttribute("data-usage-window");
      if (id && id !== win) { win = id; refresh(true).then(() => draw(`[data-usage-window="${id}"]`)); }
      return;
    }
    if (t.closest("[data-usage-retry]")) refresh(true);
    else if (t.closest("[data-usage-refresh]")) refresh(true);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopTimer();
    abort();
    root.removeEventListener && root.removeEventListener("click", onClick);
    doc && doc.removeEventListener && doc.removeEventListener("visibilitychange", onVisibility);
  }

  root.addEventListener("click", onClick);
  doc && doc.addEventListener && doc.addEventListener("visibilitychange", onVisibility);
  draw();
  startTimer();
  const first = refresh(false);
  return { destroy, refresh: () => refresh(true), first, getState: () => state };
}

// @ts-check
import { esc } from "../../shared/dom.js";
import { fitView, frameForScreen, neighborFrame, playOrder } from "./canvas-model.js";
import { itemIframe } from "./canvas-items-view.js";

/**
 * Modo "Iniciar": cada tela navegável ocupa a área inteira como um canvas próprio.
 * Os links `goto:` do protótipo movem a câmera até o quadro da tela de destino.
 */
export function createPlay(engine, interactions, toolbar, hooks = {}) {
  const bar = /** @type {HTMLElement} */ (engine.root.querySelector(".cv-play-bar"));
  let active = false;
  let currentId = null;
  let savedView = null;

  function start(fromId) {
    const order = playOrder(engine.doc);
    if (!order.length || active) return false;
    const first = engine.getItem(fromId) || order[0];
    savedView = { ...engine.doc.view };
    active = true;
    engine.root.classList.add("is-playing");
    toolbar.setHidden(true);
    interactions.setLocked(true);
    engine.select(null);
    for (const frame of order) reload(frame);
    focus(first.id, false);
    bar.hidden = false;
    engine.root.addEventListener("keydown", onKey);
    window.addEventListener("resize", refocus);
    hooks.onStart?.();
    engine.root.focus({ preventScroll: true });
    return true;
  }

  function reload(frame) {
    const iframe = itemIframe(engine.els.get(frame.id));
    if (iframe) iframe.src = iframe.src;
  }

  function focus(id, animate = true) {
    const frame = engine.getItem(id);
    if (!frame) return;
    currentId = id;
    const size = { w: engine.viewport.clientWidth, h: engine.viewport.clientHeight };
    engine.doc.view = fitView(frame, size, 52, 2);
    engine.applyView(animate);
    renderBar();
    hooks.onFocus?.(frame);
  }

  function refocus() {
    if (active && currentId) focus(currentId, false);
  }

  function renderBar() {
    const order = playOrder(engine.doc);
    const index = order.findIndex((f) => f.id === currentId);
    const frame = order[index];
    bar.innerHTML = `
      <button type="button" data-act="prev" title="Tela anterior" ${index <= 0 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>
      <span class="cv-play-info"><strong>${esc(frame?.title || "")}</strong> ${index + 1}/${order.length}</span>
      <button type="button" data-act="next" title="Próxima tela" ${index >= order.length - 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
      <button type="button" data-act="exit" title="Sair (Esc)"><i class="fa-solid fa-xmark"></i> Sair</button>`;
  }

  bar.addEventListener("click", (e) => {
    const act = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest("[data-act]"))?.dataset.act;
    if (act === "prev") step(-1);
    else if (act === "next") step(1);
    else if (act === "exit") stop();
  });

  function step(delta) {
    const target = neighborFrame(engine.doc, currentId, delta);
    if (target) focus(target.id);
  }

  function onKey(e) {
    if (e.key === "Escape") stop();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  }

  /** Navega para a tela `screenId`; devolve false se não houver quadro para ela. */
  function goto(screenId) {
    if (!active) return false;
    const frame = frameForScreen(engine.doc, screenId);
    if (!frame) return false;
    focus(frame.id);
    return true;
  }

  function stop() {
    if (!active) return;
    active = false;
    bar.hidden = true;
    engine.root.classList.remove("is-playing");
    engine.root.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", refocus);
    toolbar.setHidden(false);
    interactions.setLocked(false);
    if (savedView) { engine.doc.view = savedView; engine.applyView(true); }
    if (currentId) engine.select(currentId);
    hooks.onStop?.();
  }

  return { start, stop, goto, focus, get active() { return active; }, get currentId() { return currentId; } };
}

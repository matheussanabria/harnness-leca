// @ts-check
import { screenToWorld, normalizeRect, panBy, hitTest, ITEM_KINDS } from "./canvas-model.js";

const CREATE_TOOLS = ITEM_KINDS;
const KEY_TOOLS = { v: "select", h: "hand", f: "frame", t: "text", s: "sticky", r: "rect", c: "code" };
const MIN_W = 40;
const MIN_H = 24;

function isTyping(target) {
  const el = /** @type {HTMLElement|null} */ (target);
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Liga mouse, roda e teclado ao motor. Retorna `dispose`. */
export function bindInteractions(engine, hooks = {}) {
  const { viewport, root, doc } = engine;
  const draft = /** @type {HTMLElement} */ (root.querySelector(".cv-draft"));
  let drag = null;
  let spaceDown = false;
  let locked = false;

  const local = (e) => {
    const box = viewport.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const world = (e) => { const p = local(e); return screenToWorld(doc.view, p.x, p.y); };

  function onDown(e) {
    if (locked) return;
    root.focus({ preventScroll: true });
    const target = /** @type {HTMLElement} */ (e.target);
    const pan = e.button === 1 || engine.tool === "hand" || spaceDown;
    if (e.button !== 0 && e.button !== 1) return;
    const itemEl = /** @type {HTMLElement|null} */ (target.closest(".cv-item"));
    if (pan) return startDrag(e, { mode: "pan" });
    if (target.dataset.handle) return startDrag(e, { mode: "resize", item: engine.selected, start: world(e) });
    if (CREATE_TOOLS.includes(engine.tool)) return startDrag(e, { mode: "draw", start: world(e), kind: engine.tool });
    if (!itemEl) { engine.select(null); return startDrag(e, { mode: "pan" }); }
    const item = engine.getItem(itemEl.dataset.id);
    const wasSelected = engine.selectedId === item.id;
    engine.select(item.id);
    if (target.closest("[data-nodrag]") || itemEl.classList.contains("is-editing") || engine.interactiveId === item.id) return;
    startDrag(e, { mode: "move", item, wasSelected, start: world(e), origin: { x: item.x, y: item.y } });
  }

  function startDrag(e, state) {
    drag = { ...state, last: local(e), moved: false };
    viewport.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    const p = local(e);
    const dx = p.x - drag.last.x;
    const dy = p.y - drag.last.y;
    if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;
    if (drag.mode === "pan") { doc.view = panBy(doc.view, dx, dy); engine.applyView(); }
    else if (drag.mode === "move") moveItem(e);
    else if (drag.mode === "resize") resizeItem(e);
    else if (drag.mode === "draw") drawDraft(e);
    drag.last = p;
  }

  function moveItem(e) {
    const w = world(e);
    drag.item.x = Math.round(drag.origin.x + (w.x - drag.start.x));
    drag.item.y = Math.round(drag.origin.y + (w.y - drag.start.y));
    engine.commit(drag.item);
  }

  function resizeItem(e) {
    const w = world(e);
    drag.item.w = Math.max(MIN_W, Math.round(w.x - drag.item.x));
    drag.item.h = Math.max(MIN_H, Math.round(w.y - drag.item.y));
    engine.commit(drag.item);
  }

  function drawDraft(e) {
    const p = local(e);
    const a = worldToLocal(drag.start);
    const r = normalizeRect(a, p);
    draft.hidden = false;
    Object.assign(draft.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  }

  function worldToLocal(point) {
    return { x: point.x * doc.view.zoom + doc.view.x, y: point.y * doc.view.zoom + doc.view.y };
  }

  function onUp(e) {
    if (!drag) return;
    const state = drag;
    drag = null;
    draft.hidden = true;
    viewport.releasePointerCapture?.(e.pointerId);
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    if (state.mode === "draw") finishDraw(e, state);
    // clique simples num quadro já selecionado libera a interação com a tela (editar elementos)
    if (state.mode === "move" && !state.moved && state.wasSelected && state.item.kind === "frame") enterInteract(state.item);
    engine.saver.schedule();
  }

  function finishDraw(e, state) {
    const end = world(e);
    const r = normalizeRect(state.start, end);
    const sized = r.w > 8 && r.h > 8;
    const item = engine.add(state.kind, sized ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } : { x: Math.round(state.start.x), y: Math.round(state.start.y) });
    if (state.kind === "frame") item.title = item.title || "Quadro";
    engine.setTool("select");
    if (state.kind === "text" || state.kind === "sticky") engine.els.get(item.id)?.dispatchEvent(new MouseEvent("dblclick"));
    hooks.onCreate?.(item);
  }

  function enterInteract(frame) {
    engine.setInteractive(frame.id);
    hooks.onInteract?.(frame);
  }

  // Com captura de ponteiro o alvo do dblclick é o viewport, então localiza o quadro pela posição.
  function onDblClick(e) {
    if (locked) return;
    const w = world(e);
    const item = hitTest(doc.items, w.x, w.y);
    if (item?.kind === "frame") enterInteract(item);
  }

  function onWheel(e) {
    if (locked) return;
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || e.metaKey) engine.zoomBy(Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.01), p.x, p.y);
    else { doc.view = panBy(doc.view, e.shiftKey ? -e.deltaY : -e.deltaX, e.shiftKey ? 0 : -e.deltaY); engine.applyView(); }
  }

  function onKeyDown(e) {
    if (locked || isTyping(e.target)) return;
    if (e.code === "Space") { spaceDown = true; root.classList.add("is-panning"); e.preventDefault(); return; }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === "d") { e.preventDefault(); engine.duplicate(); }
    else if (key === "delete" || key === "backspace") { engine.remove(); }
    else if (key === "escape") { engine.setTool("select"); engine.select(null); }
    else if (e.shiftKey && key === "1" || e.key === "!") engine.fit();
    else if (key === "0" && !mod) engine.setZoom(1);
    else if (key === "+" || key === "=") engine.zoomBy(1.2);
    else if (key === "-") engine.zoomBy(1 / 1.2);
    else if (key.startsWith("arrow") && engine.selected) nudge(e, key);
    else if (!mod && KEY_TOOLS[key]) engine.setTool(KEY_TOOLS[key]);
  }

  function nudge(e, key) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const item = engine.selected;
    if (key === "arrowleft") item.x -= step;
    if (key === "arrowright") item.x += step;
    if (key === "arrowup") item.y -= step;
    if (key === "arrowdown") item.y += step;
    engine.commit(item);
  }

  function onKeyUp(e) {
    if (e.code === "Space") { spaceDown = false; root.classList.remove("is-panning"); }
  }

  viewport.addEventListener("pointerdown", onDown);
  viewport.addEventListener("pointermove", onMove);
  viewport.addEventListener("pointerup", onUp);
  viewport.addEventListener("pointercancel", onUp);
  viewport.addEventListener("dblclick", onDblClick);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("keyup", onKeyUp);

  return {
    setLocked(value) { locked = value; },
    dispose() {
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      viewport.removeEventListener("dblclick", onDblClick);
      viewport.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("keyup", onKeyUp);
    },
  };
}

// @ts-check
import {
  createDoc, syncScreens, syncSnippets, newItem, bringToFront, duplicateItem, removeItem, fitView, itemsBounds, zoomAt, clampZoom,
} from "./canvas-model.js";
import { loadDoc, createSaver } from "./canvas-store.js";
import { buildItemEl, applyGeometry, itemIframe } from "./canvas-items-view.js";

/**
 * Motor do canvas: documento, câmera, seleção e DOM dos itens.
 * Não conhece mouse/teclado (ver canvas-interactions.js) nem o Play (canvas-play.js).
 */
export function createEngine(options) {
  const { host, slug, protoId, screens, viewportWidth, renderUrl, onSelectFrame } = options;
  const doc = syncSnippets(syncScreens(loadDoc(slug, protoId) || createDoc(screens, viewportWidth), screens, viewportWidth), screens);
  const saver = createSaver(slug, protoId, () => doc);
  const els = new Map();
  let selectedId = null;
  let interactiveId = null;
  let tool = "select";

  host.innerHTML = `
    <div class="cv-root" tabindex="0">
      <div class="cv-toolbar-slot"></div>
      <div class="cv-viewport"><div class="cv-world"></div><div class="cv-draft" hidden></div></div>
      <div class="cv-zoom-readout">100%</div>
      <div class="cv-play-bar" hidden></div>
    </div>`;
  const root = /** @type {HTMLElement} */ (host.querySelector(".cv-root"));
  const viewport = /** @type {HTMLElement} */ (root.querySelector(".cv-viewport"));
  const world = /** @type {HTMLElement} */ (root.querySelector(".cv-world"));
  const ctx = { renderUrl, commit: (item) => commit(item), interact: (item) => { setInteractive(item.id); onSelectFrame?.(item); } };

  function commit(item) {
    if (item) {
      const el = els.get(item.id);
      if (el) applyGeometry(el, item);
    }
    saver.schedule();
  }

  function applyView(animate = false) {
    const { x, y, zoom } = doc.view;
    world.classList.toggle("is-animating", animate);
    world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    root.style.setProperty("--cv-inv", String(1 / zoom));
    const readout = root.querySelector(".cv-zoom-readout");
    if (readout) readout.textContent = `${Math.round(zoom * 100)}%`;
    saver.schedule();
  }

  function renderAll() {
    world.innerHTML = "";
    els.clear();
    for (const item of doc.items) addEl(item);
    refreshState();
  }

  function addEl(item) {
    const el = buildItemEl(item, ctx);
    els.set(item.id, el);
    world.appendChild(el);
    return el;
  }

  function refreshState() {
    for (const [id, el] of els) {
      el.classList.toggle("is-selected", id === selectedId);
      el.classList.toggle("is-interactive", id === interactiveId);
      el.querySelector(".cv-handle")?.remove();
      if (id === selectedId) el.insertAdjacentHTML("beforeend", '<div class="cv-handle" data-handle="se"></div>');
    }
    root.dataset.tool = tool;
  }

  function select(id) {
    if (selectedId === id) return;
    selectedId = id;
    if (interactiveId && interactiveId !== id) interactiveId = null;
    const item = doc.items.find((i) => i.id === id);
    if (item) { bringToFront(doc, id); applyGeometry(els.get(id), item); }
    refreshState();
    if (item?.kind === "frame") onSelectFrame?.(item);
    root.dispatchEvent(new CustomEvent("cv-select", { detail: item || null }));
  }

  function setInteractive(id) {
    interactiveId = id;
    if (id) select(id);
    refreshState();
  }

  function setTool(next) {
    tool = next;
    refreshState();
    root.dispatchEvent(new CustomEvent("cv-tool", { detail: next }));
  }

  function add(kind, props = {}) {
    const item = newItem(doc, kind, props);
    doc.items.push(item);
    addEl(item);
    select(item.id);
    saver.schedule();
    return item;
  }

  function remove(id = selectedId) {
    const item = getItem(id);
    if (!item) return false;
    const isOnlyFrameOfScreen = item.kind === "frame" && doc.items.filter((i) => i.kind === "frame" && i.screen === item.screen).length < 2;
    if (isOnlyFrameOfScreen) return false;
    els.get(id)?.remove();
    els.delete(id);
    removeItem(doc, id);
    if (selectedId === id) { selectedId = null; refreshState(); }
    saver.schedule();
    return true;
  }

  function duplicate(id = selectedId) {
    const copy = id ? duplicateItem(doc, id) : null;
    if (!copy) return null;
    addEl(copy);
    select(copy.id);
    saver.schedule();
    return copy;
  }

  function fit(animate = true, items = doc.items) {
    const size = { w: viewport.clientWidth, h: viewport.clientHeight };
    doc.view = fitView(itemsBounds(items), size, 60, 1);
    applyView(animate);
  }

  function zoomBy(factor, px = viewport.clientWidth / 2, py = viewport.clientHeight / 2) {
    doc.view = zoomAt(doc.view, factor, px, py);
    applyView(false);
  }

  function setZoom(zoom) {
    zoomBy(clampZoom(zoom) / doc.view.zoom);
  }

  function frameOfWindow(win) {
    for (const [id, el] of els) {
      if (itemIframe(el)?.contentWindow === win) return doc.items.find((i) => i.id === id) || null;
    }
    return null;
  }

  const getItem = (id) => doc.items.find((i) => i.id === id) || null;

  return {
    doc, root, viewport, world, els, saver, commit, applyView, renderAll, select, setInteractive, setTool, add, remove, duplicate,
    fit, zoomBy, setZoom, frameOfWindow, getItem, addEl,
    get selectedId() { return selectedId; },
    get interactiveId() { return interactiveId; },
    get tool() { return tool; },
    get selected() { return selectedId ? getItem(selectedId) : null; },
  };
}

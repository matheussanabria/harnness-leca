// @ts-check
// Keyframe panel of the Atelier (EP-24.06, approved prototype docs/features/motion-keyframes/03-prototype.html).
// Loads the screen timeline, previews every change live through HARNESS_MOTION_LOAD, saves through the API (Atelier
// history: Ctrl+Z / Ctrl+Y) and keeps layer selection in sync both ways. Rules: motion-timeline-state.js.
import { ctx } from "./prototype-atelier-ctx.js";
import { showToast } from "../shared/dom.js";
import { refreshHistorySoon } from "./prototype-history-panel.js";
import { loadTimeline, saveTimeline } from "./motion-timeline-api.js";
import { snapTime, moveKey, addKeyAt, removeKey, setKeyValue, setKeyEase, bezierEase, frameMs } from "./motion-timeline-state.js";
import { rulerHtml, labelsHtml, lanesHtml, inspectorHtml, panelShellHtml, pct } from "./motion-timeline-view.js";
import { startKeyDrag } from "./motion-timeline-drag.js";

const HOST_ID = "atelierMotionTimeline";
const p = { open: false, available: false, doc: /** @type {any} */ (null), rev: /** @type {string | null} */ (null), sel: { track: 0, key: 0 }, time: 0, tree: /** @type {any[]} */ ([]), saving: Promise.resolve(), installed: false };

const hostEl = () => document.getElementById(HOST_ID);
const part = (/** @type {string} */ name) => /** @type {HTMLElement | null} */ (hostEl()?.querySelector(`[data-tl="${name}"]`) || null);
const iframe = () => /** @type {HTMLIFrameElement | null} */ (document.getElementById("atelierIframe"));
const where = () => ({ slug: ctx.slug, protoId: ctx.protoId, screen: ctx.screen });
const post = (/** @type {object} */ msg) => iframe()?.contentWindow?.postMessage(msg, "*");

function paintPlayhead() {
  const head = part("playhead");
  if (head && p.doc) head.style.left = pct(p.time, p.doc.duration);
}

export function renderTimeline() {
  const host = hostEl();
  const button = document.querySelector('[data-motion="timeline"]');
  button?.classList.toggle("active", p.open);
  button?.setAttribute("aria-pressed", String(p.open));
  if (!host) return;
  host.hidden = !(p.open && p.available && p.doc);
  if (host.hidden) return;
  if (host.dataset.built !== "1") { host.innerHTML = panelShellHtml(); host.dataset.built = "1"; }
  const tree = p.tree.length ? p.tree : ctx.tree || [];
  p.sel.track = Math.min(p.sel.track, p.doc.tracks.length - 1);
  /** @type {HTMLElement} */ (part("ruler")).innerHTML = rulerHtml(p.doc.duration);
  /** @type {HTMLElement} */ (part("labels")).innerHTML = labelsHtml(p.doc, tree, p.sel.track);
  /** @type {HTMLElement} */ (part("rows")).innerHTML = lanesHtml(p.doc, tree, p.sel);
  /** @type {HTMLElement} */ (part("inspector")).innerHTML = inspectorHtml(p.doc, tree, p.sel);
  paintPlayhead();
}

async function reload() {
  if (!p.open || !ctx.slug || !ctx.protoId) return;
  try {
    const { doc, rev } = await loadTimeline(where());
    p.doc = doc;
    p.rev = rev;
  } catch {
    p.doc = null;
  }
  renderTimeline();
}

/** Applies a new document: live preview now, one saved history entry per change. @param {any} doc @param {string} label */
function commit(doc, label) {
  p.doc = doc;
  renderTimeline();
  post({ type: "HARNESS_MOTION_LOAD", doc });
  post({ type: "HARNESS_MOTION_SEEK", ms: p.time });
  p.saving = p.saving.then(async () => {
    const res = await saveTimeline(where(), doc, p.rev, label);
    if (res.ok) { p.rev = res.rev; refreshHistorySoon(); return; }
    showToast(res.status === 409 ? "A animação mudou em outro lugar; recarreguei a versão atual." : `Não foi possível salvar: ${res.error}`);
    await reload();
    if (p.doc) post({ type: "HARNESS_MOTION_LOAD", doc: p.doc });
  });
}

/** @param {number} ti @param {number} [ki] */
function select(ti, ki = 0, syncLayer = true) {
  p.sel = { track: ti, key: ki };
  renderTimeline();
  const pid = p.doc?.tracks[ti]?.target;
  if (syncLayer && pid) post({ type: "HARNESS_PROTO_SELECT_BY_PID", pid });
}

function onPointerDown(/** @type {PointerEvent} */ e) {
  const btn = /** @type {HTMLElement} */ (e.target)?.closest?.(".motion-tl__key");
  if (!btn || !p.doc || e.button !== 0) return;
  const ti = Number(btn.getAttribute("data-tl-track"));
  const ki = Number(btn.getAttribute("data-tl-key"));
  select(ti, ki);
  const fresh = /** @type {HTMLElement} */ (part("rows")?.querySelector(`[data-tl-track="${ti}"][data-tl-key="${ki}"]`));
  fresh?.focus();
  const base = p.doc;
  startKeyDrag(e, {
    button: fresh || /** @type {HTMLElement} */ (btn), doc: base, ti, ki, lanes: /** @type {HTMLElement} */ (part("lanes")), rows: /** @type {HTMLElement} */ (part("rows")),
    onMove: (t) => { post({ type: "HARNESS_MOTION_LOAD", doc: moveKey(base, ti, ki, t) }); post({ type: "HARNESS_MOTION_SEEK", ms: t }); },
    onEnd: (t, moved) => { if (moved) { p.time = t; commit(moveKey(base, ti, ki, t), `Keyframe movido para ${t} ms`); } },
  });
}

function onClick(/** @type {MouseEvent} */ e) {
  const target = /** @type {HTMLElement} */ (e.target);
  if (!hostEl()?.contains(target) || !p.doc) return;
  const label = target.closest(".motion-tl__label");
  if (label) return select(Number(label.getAttribute("data-tl-track")));
  const ruler = target.closest('[data-tl="ruler"]');
  if (ruler) {
    const r = ruler.getBoundingClientRect();
    const fm = frameMs(p.doc.fps);
    p.time = Math.max(0, Math.min(p.doc.duration, Math.round(Math.round((((e.clientX - r.left) / r.width) * p.doc.duration) / fm) * fm)));
    paintPlayhead();
    return post({ type: "HARNESS_MOTION_SEEK", ms: p.time });
  }
  const act = target.closest("[data-tl-act]")?.getAttribute("data-tl-act");
  if (act === "add") {
    const added = addKeyAt(p.doc, p.sel.track, p.time);
    if (!added) return showToast("Já existe um keyframe nesse tempo.");
    p.sel.key = added.index;
    commit(added.doc, `Keyframe adicionado em ${Math.round(p.time)} ms`);
  } else if (act === "remove") removeSelected();
}

function removeSelected() {
  const next = p.doc && removeKey(p.doc, p.sel.track, p.sel.key);
  if (!next) return showToast("A faixa precisa de pelo menos um keyframe.");
  p.sel.key = Math.max(0, p.sel.key - 1);
  commit(next, "Keyframe removido");
}

function onChange(/** @type {Event} */ e) {
  const el = /** @type {HTMLInputElement} */ (e.target);
  if (!hostEl()?.contains(el) || !p.doc) return;
  const { track: ti, key: ki } = p.sel;
  if (el.dataset.tlProp) commit(setKeyValue(p.doc, ti, ki, el.dataset.tlProp, el.value), `Valor de ${el.dataset.tlProp} alterado`);
  else if (el.hasAttribute("data-tl-ease")) commit(setKeyEase(p.doc, ti, ki, el.value === "custom" ? bezierEase([0.25, 0.1, 0.25, 1]) : el.value), "Easing alterado");
  else if (el.dataset.tlBez !== undefined) {
    const parts = Array.from(hostEl()?.querySelectorAll("[data-tl-bez]") || []).map((i) => /** @type {HTMLInputElement} */ (i).value);
    commit(setKeyEase(p.doc, ti, ki, bezierEase(parts)), "Easing alterado");
  }
}

function onKey(/** @type {KeyboardEvent} */ e) {
  const target = /** @type {HTMLElement} */ (e.target);
  if (!hostEl()?.contains(target) || !p.doc || /^(input|select|textarea)$/i.test(target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const tr = p.doc.tracks[p.sel.track];
  const key = tr?.keys[p.sel.key];
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && key) {
    e.preventDefault();
    const width = part("rows")?.getBoundingClientRect().width || 0;
    const t = snapTime(p.doc, p.sel.track, p.sel.key, key.t + (e.key === "ArrowRight" ? 1 : -1) * frameMs(p.doc.fps), { pxPerMs: width / p.doc.duration });
    if (t === key.t) return;
    p.time = t;
    commit(moveKey(p.doc, p.sel.track, p.sel.key, t), `Keyframe movido para ${t} ms`);
    /** @type {HTMLElement | null} */ (part("rows")?.querySelector(".motion-tl__key.is-sel") || null)?.focus();
  } else if (e.key === "Delete" && key) { e.preventDefault(); e.stopPropagation(); removeSelected(); }
  else if (e.key === "Enter" && key && target.closest(".motion-tl__key")) { e.preventDefault(); /** @type {HTMLElement | null} */ (part("inspector")?.querySelector("input:not([disabled]), select:not([disabled])") || null)?.focus(); }
}

function onMessage(/** @type {MessageEvent} */ e) {
  const frame = iframe();
  if (!frame || e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
  const { type } = e.data;
  if ((type === "HARNESS_MOTION_TIME" || type === "HARNESS_MOTION_SEEKED") && Number.isFinite(e.data.ms)) { p.time = e.data.ms; paintPlayhead(); }
  else if (type === "HARNESS_PROTO_TREE") { p.tree = e.data.tree || []; renderTimeline(); }
  else if (type === "HARNESS_PROTO_SELECT" && p.doc && e.data.pid) {
    const ti = p.doc.tracks.findIndex((/** @type {any} */ t) => t.target === e.data.pid);
    if (ti >= 0 && ti !== p.sel.track) select(ti, 0, false);
  }
}

/** Player hook: the panel can show only while the player bar is open on a screen with a timeline. @param {boolean} on */
export function setTimelineAvailable(on) {
  if (on === p.available) return; // called on every player paint (up to 60 per second): only react to changes
  p.available = on;
  if (on && p.open) void reload(); else renderTimeline();
}

export function toggleTimeline() {
  p.open = !p.open;
  if (p.open) void reload(); else renderTimeline();
}

/** Safe on every Atelier render: repaints into the fresh host, installs the listeners once. */
export function setupTimelinePanel() {
  renderTimeline();
  if (p.installed) return;
  p.installed = true;
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("focusin", (e) => {
    const label = /** @type {HTMLElement} */ (e.target)?.closest?.(`#${HOST_ID} .motion-tl__label`);
    if (label && Number(label.getAttribute("data-tl-track")) !== p.sel.track) { select(Number(label.getAttribute("data-tl-track"))); /** @type {HTMLElement | null} */ (part("labels")?.querySelector(".is-sel") || null)?.focus(); }
  });
  window.addEventListener("message", onMessage);
  // A new document in the iframe (undo, agent write, screen switch) means the timeline on disk may have changed.
  document.addEventListener("load", (e) => { if (/** @type {HTMLElement} */ (e.target)?.id === "atelierIframe") void reload(); }, true);
}

/** Test hook. */
export const timelineTest = { state: () => p, reload, commit };

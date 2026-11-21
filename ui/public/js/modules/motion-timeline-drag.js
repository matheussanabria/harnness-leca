// @ts-check
// Keyframe drag of the timeline panel (EP-24.06): pointer capture, snap through snapTime (Shift = free), a time tip,
// and at most one preview update per animation frame. The caller saves once, on release.
import { snapTime } from "./motion-timeline-state.js";
import { pct } from "./motion-timeline-view.js";

/**
 * @param {PointerEvent} event pointerdown on a keyframe button
 * @param {{ button: HTMLElement, doc: any, ti: number, ki: number, lanes: HTMLElement, rows: HTMLElement,
 *   onMove: (t: number) => void, onEnd: (t: number, moved: boolean) => void }} opts
 */
export function startKeyDrag(event, opts) {
  const { button } = opts; // the freshly rendered key button (the one under the pointer may have been replaced)
  const rect = opts.rows.getBoundingClientRect();
  const pxPerMs = rect.width / opts.doc.duration;
  const start = opts.doc.tracks[opts.ti].keys[opts.ki].t;
  let current = start;
  let frame = 0;
  const tip = document.createElement("div");
  tip.className = "motion-tl__tip";
  tip.setAttribute("aria-hidden", "true");
  opts.lanes.appendChild(tip);
  try { button.setPointerCapture?.(event.pointerId); } catch { /* synthetic events */ }

  /** @param {PointerEvent} e */
  const move = (e) => {
    const raw = (e.clientX - rect.left) / pxPerMs;
    const t = snapTime(opts.doc, opts.ti, opts.ki, raw, { free: e.shiftKey, pxPerMs });
    if (t === current) return;
    current = t;
    const left = pct(t, opts.doc.duration);
    const key = /** @type {HTMLElement | null} */ (opts.rows.querySelector(`[data-tl-track="${opts.ti}"][data-tl-key="${opts.ki}"]`));
    if (key) key.style.left = left;
    tip.style.left = left;
    tip.style.top = `${(key?.offsetTop || 0) + (key?.parentElement?.offsetTop || 0)}px`;
    tip.textContent = `${t} ms`;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => opts.onMove(t));
  };
  const end = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    cancelAnimationFrame(frame);
    tip.remove();
    opts.onEnd(current, current !== start);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  event.preventDefault();
}

// @ts-check
// Pure rules of the keyframe panel (EP-24.06, approved prototype docs/features/motion-keyframes/03-prototype.html).
// Every function returns a new motion@1 document and never mutates its input; keys stay sorted by time.

export const SNAP_PX = 4;
export const EASES = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];
const DEFAULT_BEZIER = [0.25, 0.1, 0.25, 1];

/** @param {any} doc */
const clone = (doc) => JSON.parse(JSON.stringify(doc));
/** @param {number} fps */
export const frameMs = (fps) => 1000 / (fps || 30);

/**
 * Time for a dragged or nudged key (CP-21, CP-22): nearest frame, or another key within SNAP_PX pixels; Shift (free)
 * skips both. Always strictly between the neighbors of the same track, one frame away (1 ms when free).
 * @param {any} doc @param {number} ti @param {number} ki @param {number} raw
 * @param {{ free?: boolean, pxPerMs?: number }} [opts] pxPerMs <= 0 turns key snapping off
 */
export function snapTime(doc, ti, ki, raw, opts = {}) {
  const fm = frameMs(doc.fps);
  const free = Boolean(opts.free);
  let t = free ? Math.round(raw) : Math.round(Math.round(raw / fm) * fm);
  const pxPerMs = Number(opts.pxPerMs) || 0;
  if (!free && pxPerMs > 0) {
    const others = doc.tracks.flatMap((/** @type {any} */ tr, /** @type {number} */ i) => tr.keys.filter((/** @type {any} */ _, /** @type {number} */ k) => !(i === ti && k === ki)).map((/** @type {any} */ k) => k.t));
    const near = others.filter((/** @type {number} */ o) => Math.abs(o - raw) * pxPerMs < SNAP_PX).sort((/** @type {number} */ a, /** @type {number} */ b) => Math.abs(a - raw) - Math.abs(b - raw))[0];
    if (near !== undefined) t = near;
  }
  const keys = doc.tracks[ti].keys;
  const gap = free ? 1 : Math.ceil(fm);
  const min = ki > 0 ? keys[ki - 1].t + gap : 0;
  const max = ki < keys.length - 1 ? keys[ki + 1].t - gap : doc.duration;
  return Math.max(min, Math.min(max, t));
}

/** @param {any} doc @param {number} ti @param {number} ki @param {number} t */
export function moveKey(doc, ti, ki, t) {
  const next = clone(doc);
  next.tracks[ti].keys[ki].t = t;
  return next;
}

/**
 * Adds a key at `t` with the values the track has there (carried from the previous key, else the next one).
 * @param {any} doc @param {number} ti @param {number} t
 * @returns {{ doc: any, index: number } | null} null when the track already has a key at that time
 */
export function addKeyAt(doc, ti, t) {
  const time = Math.max(0, Math.min(doc.duration, Math.round(t)));
  const keys = doc.tracks[ti].keys;
  if (keys.some((/** @type {any} */ k) => k.t === time)) return null;
  const before = [...keys].reverse().find((/** @type {any} */ k) => k.t < time);
  const source = before || keys.find((/** @type {any} */ k) => k.t > time) || { props: { opacity: 1 } };
  const next = clone(doc);
  const key = { t: time, props: { ...source.props } };
  const list = next.tracks[ti].keys;
  const index = list.findIndex((/** @type {any} */ k) => k.t > time);
  const at = index === -1 ? list.length : index;
  list.splice(at, 0, key);
  return { doc: next, index: at };
}

/** Removes a key; the last key of a track stays (a track needs at least one). @returns {any | null} */
export function removeKey(/** @type {any} */ doc, /** @type {number} */ ti, /** @type {number} */ ki) {
  if (doc.tracks[ti].keys.length <= 1) return null;
  const next = clone(doc);
  next.tracks[ti].keys.splice(ki, 1);
  return next;
}

/** Numbers stay numbers ("0.5" -> 0.5); everything else is the trimmed text. @param {string} raw */
export function parseValue(raw) {
  const text = String(raw ?? "").trim();
  return text !== "" && Number.isFinite(Number(text)) ? Number(text) : text;
}

/** @param {any} doc @param {number} ti @param {number} ki @param {string} prop @param {string} raw */
export function setKeyValue(doc, ti, ki, prop, raw) {
  const next = clone(doc);
  next.tracks[ti].keys[ki].props[prop] = parseValue(raw);
  return next;
}

/** @param {any} doc @param {number} ti @param {number} ki @param {string | null} ease null or "linear" clears it */
export function setKeyEase(doc, ti, ki, ease) {
  const next = clone(doc);
  const key = next.tracks[ti].keys[ki];
  if (!ease || ease === "linear") delete key.ease;
  else key.ease = ease;
  return next;
}

/** Splits an ease into the select value and the four bezier numbers. @param {string | undefined} ease */
export function easeParts(ease) {
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(String(ease || "").trim());
  if (m) return { key: "custom", bezier: m[1].split(",").map((v) => Number(v.trim())) };
  return { key: EASES.includes(String(ease)) ? String(ease) : "linear", bezier: DEFAULT_BEZIER };
}

/** @param {Array<number | string>} parts */
export const bezierEase = (parts) => `cubic-bezier(${parts.map((v) => Number(v)).join(", ")})`;

/**
 * Track label from the Atelier layer tree: "<displayName>" or the pid when the element is not on the screen.
 * @param {any[]} tree @param {string} pid
 */
export function trackLabel(tree, pid) {
  /** @type {any[]} */ const stack = Array.isArray(tree) ? [...tree] : [];
  while (stack.length) {
    const node = stack.shift();
    if (node && node.pid === pid) return node.displayName || node.tag || pid;
    if (node && Array.isArray(node.children)) stack.push(...node.children);
  }
  return pid;
}

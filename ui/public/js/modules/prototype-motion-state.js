// @ts-check
// Pure state of the Atelier motion player (EP-24.03): time, duration, fps, loop and play status.
// No DOM: prototype-motion-player.js renders it and talks to the iframe runtime.

/**
 * @typedef {{ has: boolean, open: boolean, duration: number, fps: number, tracks: number, keyTimes: number[],
 *   time: number, playing: boolean, loop: boolean, size: { w: number, h: number } | null }} MotionState
 */

/** @returns {MotionState} */
export function createMotionState() {
  return { has: false, open: false, duration: 0, fps: 30, tracks: 0, keyTimes: [], time: 0, playing: false, loop: false, size: null };
}

/** @param {MotionState} s @param {number} ms */
export function clampTime(s, ms) {
  const n = Number(ms);
  return Math.max(0, Math.min(s.duration, Number.isFinite(n) ? n : 0));
}

/**
 * The iframe runtime announced a timeline (first load or a new one from the chat).
 * The current time is kept when it still fits; otherwise it moves to the new end (CP-10).
 * @param {MotionState} s
 * @param {{ duration?: number, fps?: number, tracks?: number, keyTimes?: number[], loop?: boolean, size?: { w: number, h: number } | null }} info
 * @returns {MotionState}
 */
export function onReady(s, info) {
  const duration = Math.max(0, Number(info.duration) || 0);
  const keyTimes = Array.isArray(info.keyTimes) ? info.keyTimes.filter((t) => Number.isFinite(t) && t >= 0 && t <= duration) : [];
  const size = info.size && Number(info.size.w) > 0 && Number(info.size.h) > 0 ? { w: Number(info.size.w), h: Number(info.size.h) } : null;
  const next = { ...s, has: duration > 0, duration, fps: Number(info.fps) || 30, tracks: Number(info.tracks) || 0, keyTimes, size, playing: false };
  if (typeof info.loop === "boolean" && !s.has) next.loop = info.loop;
  next.time = clampTime(next, s.time);
  return next;
}

/** Frame duration in ms. @param {MotionState} s */
export const frameMs = (s) => 1000 / (s.fps || 30);

/**
 * Time one frame before or after the current one, snapped to the frame grid (CP-09).
 * @param {MotionState} s @param {1 | -1} dir
 */
export function stepTime(s, dir) {
  const ms = frameMs(s);
  return clampTime(s, Math.round((Math.round(s.time / ms) + dir) * ms));
}

/** "mm:ss.mmm" @param {number} ms */
export function formatTime(ms) {
  const total = Math.max(0, Number(ms) || 0) / 1000;
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${(total - minutes * 60).toFixed(3).padStart(6, "0")}`;
}

/** Screen-reader text for the scrub, e.g. "1,250 segundo de 4,000". @param {number} ms @param {number} duration */
export function timeValueText(ms, duration) {
  const s = (v) => (Math.max(0, v) / 1000).toFixed(3).replace(".", ",");
  return `${s(ms)} segundo de ${s(duration)}`;
}

/** The runtime reported a time while playing. @param {MotionState} s @param {number} ms */
export function onTime(s, ms) {
  return { ...s, time: clampTime(s, ms) };
}

/** The runtime reached the end without loop. @param {MotionState} s */
export function onEnded(s) {
  return { ...s, time: s.duration, playing: false };
}

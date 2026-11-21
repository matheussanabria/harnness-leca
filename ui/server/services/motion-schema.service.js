// @ts-check
"use strict";
/**
 * Pure validator for the motion@1 timeline format (ADR-018, EP-24.01).
 * No I/O: the caller passes the data-pid list of the screen.
 */

const SCHEMA = "motion@1";
const MAX_DURATION = 60000;
const FPS = new Set([24, 30, 60]);
const MAX_TRACKS = 200;
const MAX_KEYS = 100;
const MAX_VALUE_LENGTH = 200;
const ALLOWED_PROPS = new Set([
  "opacity", "transform", "color", "background-color", "filter", "clip-path",
  "stroke-dashoffset", "width", "height", "border-radius",
]);
const EASE_KEYWORDS = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"]);
const TARGET_RE = /^[\w-]{1,64}$/;
const BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/;
// Values are CSS fragments, never markup, declarations or external resources.
const UNSAFE_VALUE_RE = /[<>{};\\]|url\s*\(|expression\s*\(|@import/i;

/** @typedef {{ path: string, code: string, message: string }} Issue */

/** @param {unknown} value */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} ease */
function isValidEase(ease) {
  if (typeof ease !== "string") return false;
  const text = ease.trim();
  if (EASE_KEYWORDS.has(text)) return true;
  const m = text.match(BEZIER_RE);
  if (!m) return false;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return [x1, y1, x2, y2].every(Number.isFinite) && x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1;
}

/**
 * @param {unknown} value
 * @returns {string | null} reason when invalid
 */
function valueProblem(value) {
  if (typeof value === "number") return Number.isFinite(value) ? null : "number is not finite";
  if (typeof value !== "string") return "value must be a number or a string";
  if (!value.trim()) return "value is empty";
  if (value.length > MAX_VALUE_LENGTH) return `value is longer than ${MAX_VALUE_LENGTH} characters`;
  if (UNSAFE_VALUE_RE.test(value)) return "value contains characters or functions that are not allowed";
  return null;
}

/**
 * @param {Issue[]} errors
 * @param {unknown} props
 * @param {string} at
 */
function checkProps(errors, props, at) {
  if (!isObject(props) || Object.keys(/** @type {object} */ (props)).length === 0) {
    errors.push({ path: `${at}.props`, code: "props_required", message: "props must be a non-empty object" });
    return;
  }
  for (const [name, value] of Object.entries(/** @type {Record<string, unknown>} */ (props))) {
    if (!ALLOWED_PROPS.has(name)) {
      errors.push({ path: `${at}.props.${name}`, code: "prop_not_allowed", message: `prop "${name}" is not in the allowed list` });
      continue;
    }
    const problem = valueProblem(value);
    if (problem) errors.push({ path: `${at}.props.${name}`, code: "invalid_value", message: problem });
  }
}

/**
 * @param {Issue[]} errors
 * @param {unknown} keys
 * @param {number} duration
 * @param {string} at
 */
function checkKeys(errors, keys, duration, at) {
  if (!Array.isArray(keys) || keys.length === 0) {
    errors.push({ path: `${at}.keys`, code: "keys_required", message: "keys must be a non-empty array" });
    return;
  }
  if (keys.length > MAX_KEYS) {
    errors.push({ path: `${at}.keys`, code: "too_many_keys", message: `at most ${MAX_KEYS} keys per track` });
  }
  let previous = -1;
  keys.forEach((key, k) => {
    const kat = `${at}.keys[${k}]`;
    if (!isObject(key)) {
      errors.push({ path: kat, code: "invalid_key", message: "key must be an object" });
      return;
    }
    const t = /** @type {Record<string, unknown>} */ (key).t;
    if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || (Number.isFinite(duration) && t > duration)) {
      errors.push({ path: `${kat}.t`, code: "time_out_of_range", message: "t must be a number between 0 and duration" });
    } else if (t <= previous) {
      errors.push({ path: `${kat}.t`, code: "time_not_increasing", message: "t must be strictly increasing within a track" });
    } else {
      previous = t;
    }
    const ease = /** @type {Record<string, unknown>} */ (key).ease;
    if (ease !== undefined && !isValidEase(ease)) {
      errors.push({ path: `${kat}.ease`, code: "invalid_ease", message: "ease must be a CSS keyword or cubic-bezier(x1, y1, x2, y2) with x in [0, 1]" });
    }
    checkProps(errors, /** @type {Record<string, unknown>} */ (key).props, kat);
  });
}

/**
 * @param {Issue[]} errors
 * @param {Record<string, unknown>} doc
 */
function checkHeader(errors, doc) {
  if (doc.schema !== SCHEMA) errors.push({ path: "schema", code: "invalid_schema", message: `schema must be "${SCHEMA}"` });
  const { duration, fps, loop, size } = doc;
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration <= 0 || duration > MAX_DURATION) {
    errors.push({ path: "duration", code: "invalid_duration", message: `duration must be an integer between 1 and ${MAX_DURATION} ms` });
  }
  if (!FPS.has(/** @type {number} */ (fps))) errors.push({ path: "fps", code: "invalid_fps", message: "fps must be 24, 30 or 60" });
  if (loop !== undefined && typeof loop !== "boolean") errors.push({ path: "loop", code: "invalid_loop", message: "loop must be a boolean" });
  if (size !== undefined) {
    const s = /** @type {Record<string, unknown>} */ (size);
    const okSide = (/** @type {unknown} */ v) => Number.isInteger(v) && /** @type {number} */ (v) >= 16 && /** @type {number} */ (v) <= 3840;
    if (!isObject(size) || !okSide(s.w) || !okSide(s.h)) {
      errors.push({ path: "size", code: "invalid_size", message: "size must be { w, h } with integers between 16 and 3840" });
    }
  }
}

/**
 * Validates a motion@1 document.
 * @param {unknown} doc
 * @param {{ pids?: Iterable<string> }} [options] data-pid values present on the screen
 * @returns {{ ok: boolean, errors: Issue[], warnings: Issue[] }}
 */
function validateMotion(doc, options = {}) {
  /** @type {Issue[]} */ const errors = [];
  /** @type {Issue[]} */ const warnings = [];
  if (!isObject(doc)) {
    errors.push({ path: "", code: "invalid_document", message: "document must be an object" });
    return { ok: false, errors, warnings };
  }
  const d = /** @type {Record<string, unknown>} */ (doc);
  checkHeader(errors, d);
  const pids = options.pids ? new Set(options.pids) : null;
  const tracks = d.tracks;
  if (!Array.isArray(tracks)) {
    errors.push({ path: "tracks", code: "tracks_required", message: "tracks must be an array" });
    return { ok: false, errors, warnings };
  }
  if (tracks.length > MAX_TRACKS) errors.push({ path: "tracks", code: "too_many_tracks", message: `at most ${MAX_TRACKS} tracks` });
  const seen = new Set();
  tracks.forEach((track, i) => {
    const at = `tracks[${i}]`;
    if (!isObject(track)) {
      errors.push({ path: at, code: "invalid_track", message: "track must be an object" });
      return;
    }
    const target = /** @type {Record<string, unknown>} */ (track).target;
    if (typeof target !== "string" || !TARGET_RE.test(target)) {
      errors.push({ path: `${at}.target`, code: "invalid_target", message: "target must be a data-pid value" });
    } else if (seen.has(target)) {
      errors.push({ path: `${at}.target`, code: "duplicate_target", message: `target "${target}" already has a track` });
    } else {
      seen.add(target);
      if (pids && !pids.has(target)) {
        warnings.push({ path: `${at}.target`, code: "orphan_track", message: `target "${target}" is not on the screen` });
      }
    }
    checkKeys(errors, /** @type {Record<string, unknown>} */ (track).keys, /** @type {number} */ (d.duration), at);
  });
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * data-pid values present in a screen's HTML.
 * @param {string} html
 * @returns {Set<string>}
 */
function extractPids(html) {
  return new Set(Array.from(String(html || "").matchAll(/\sdata-pid="([^"]+)"/g), (m) => m[1]));
}

module.exports = { validateMotion, extractPids, isValidEase, ALLOWED_PROPS, SCHEMA, MAX_DURATION, MAX_TRACKS };

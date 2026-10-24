// @ts-check
// Helpers shared by the legacy telemetry mappers (T1.4, ADR-TEL-004/006).
const crypto = require("crypto");

const HASH_LENGTH = 32;

/**
 * Stable digest of the exact line content (trimmed of the line break only).
 * @param {string} line
 * @returns {string}
 */
function lineHash(line) {
  return crypto.createHash("sha256").update(line, "utf8").digest("hex").slice(0, HASH_LENGTH);
}

/**
 * idempotencyKey = legacy:<file name>:<line content hash>. Independent of line position.
 * @param {string} fileName
 * @param {string} line
 * @returns {string}
 */
function legacyKey(fileName, line) {
  return `legacy:${fileName}:${lineHash(line)}`;
}

/**
 * Absent or invalid numbers stay null; never coerced to 0.
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * @param {unknown} value ISO timestamp candidate
 * @returns {string | null}
 */
function isoOrNull(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * @param {string} line
 * @returns {{ ok: true, record: Record<string, any> } | { ok: false, reason: string }}
 */
function parseLine(line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return { ok: false, reason: "unparsable_json" };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "not_an_object" };
  return { ok: true, record: value };
}

module.exports = { lineHash, legacyKey, numberOrNull, textOrNull, isoOrNull, parseLine };

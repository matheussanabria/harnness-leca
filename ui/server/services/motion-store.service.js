// @ts-check
"use strict";
/**
 * Disk store for screen timelines: screens/<screen>.motion.json next to the screen HTML (ADR-018, EP-24.01).
 * Atomic writes (temp file + rename) and an optimistic `rev` (content hash) against concurrent overwrites.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { validateMotion, extractPids } = require("./motion-schema.service");

const MAX_BYTES = 64 * 1024;
const ID_RE = /^[\w-]{1,80}$/;

class MotionError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {object} [details]
   */
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** @param {string} text */
function revOf(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

/**
 * Resolves the screen HTML and its timeline path from proto.json.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} screenId
 */
function resolveScreen(projectDir, protoId, screenId) {
  if (!ID_RE.test(protoId) || !ID_RE.test(screenId)) throw new MotionError(400, "invalid_id", "Invalid prototype or screen id.");
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);
  let proto;
  try {
    proto = JSON.parse(fs.readFileSync(path.join(protoDir, "proto.json"), "utf8"));
  } catch {
    throw new MotionError(404, "prototype_not_found", `Prototype '${protoId}' not found.`);
  }
  const screen = (Array.isArray(proto.screens) ? proto.screens : []).find((s) => s && s.id === screenId);
  if (!screen || typeof screen.file !== "string" || !screen.file.endsWith(".html")) {
    throw new MotionError(404, "screen_not_found", `Screen '${screenId}' not found.`);
  }
  const htmlFile = path.resolve(protoDir, screen.file);
  if (!htmlFile.startsWith(path.resolve(protoDir) + path.sep)) throw new MotionError(400, "invalid_path", "Screen file is outside the prototype.");
  return { htmlFile, motionFile: htmlFile.replace(/\.html$/, ".motion.json") };
}

/** @param {string} file */
function readTextOrNull(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) throw new MotionError(500, "storage_error", "Timeline path is not a regular file.");
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err instanceof MotionError) throw err;
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
    throw new MotionError(500, "storage_error", "Could not read the timeline.");
  }
}

/**
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} screenId
 * @returns {{ doc: object | null, rev: string | null, warnings: object[] }}
 */
function readMotion(projectDir, protoId, screenId) {
  const { htmlFile, motionFile } = resolveScreen(projectDir, protoId, screenId);
  const text = readTextOrNull(motionFile);
  if (text === null) return { doc: null, rev: null, warnings: [] };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new MotionError(500, "corrupt_timeline", "Stored timeline is not valid JSON.");
  }
  const pids = extractPids(readTextOrNull(htmlFile) || "");
  return { doc, rev: revOf(text), warnings: validateMotion(doc, { pids }).warnings };
}

/**
 * Validates and writes a timeline. `rev` must match the stored one; a missing file accepts no rev.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} screenId
 * @param {unknown} doc
 * @param {{ rev?: string | null }} [options]
 * @returns {{ doc: object, rev: string, warnings: object[] }}
 */
function writeMotion(projectDir, protoId, screenId, doc, options = {}) {
  const { htmlFile, motionFile } = resolveScreen(projectDir, protoId, screenId);
  const text = JSON.stringify(doc, null, 2) + "\n";
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    throw new MotionError(413, "timeline_too_large", `Timeline is larger than ${MAX_BYTES / 1024} KB.`);
  }
  const pids = extractPids(readTextOrNull(htmlFile) || "");
  const result = validateMotion(doc, { pids });
  if (!result.ok) throw new MotionError(422, "invalid_timeline", "Timeline is not valid motion@1.", { errors: result.errors, warnings: result.warnings });

  const current = readTextOrNull(motionFile);
  const currentRev = current === null ? null : revOf(current);
  const expected = options.rev ?? null;
  if (currentRev !== expected) {
    throw new MotionError(409, "rev_conflict", "Timeline changed since it was read.", { rev: currentRev });
  }
  const tmp = `${motionFile}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, motionFile);
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* temp file may not exist */ }
    throw new MotionError(500, "storage_error", "Could not write the timeline.");
  }
  return { doc: /** @type {object} */ (doc), rev: revOf(text), warnings: result.warnings };
}

module.exports = { readMotion, writeMotion, resolveScreen, revOf, MotionError, MAX_BYTES };

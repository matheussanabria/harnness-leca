// @ts-check
// Read-only access to doc/ of a project repo: every path is checked before any read.
// Rules: relative path only, no "." or ".." segment, no percent sign, allowed extension, not a secret,
// and the real path (after symlinks and Windows junctions) must stay inside the real doc/ folder.
const fs = require("node:fs");
const path = require("node:path");
const { createSecretFilter } = require("./secret-rules");

const DOC_DIR = "doc";
const ALLOWED_EXT = new Set([".md", ".yml", ".yaml", ".json"]);
const MAX_BYTES = 1024 * 1024;
const MAX_PATH = 400;

/**
 * @param {unknown} rel path as received
 * @returns {string | null} normalized path with forward slashes, or null when the shape is invalid
 */
function normalizeRel(rel) {
  if (typeof rel !== "string") return null;
  const text = rel.replace(/\\/g, "/");
  if (!text || text.length > MAX_PATH || text.includes("\0") || text.includes("%")) return null;
  if (text.startsWith("/") || /^[a-z]:/i.test(text)) return null;
  const parts = text.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || p.startsWith("."))) return null;
  return parts.join("/");
}

/** @param {string} child @param {string} parent */
function isInside(child, parent) {
  const a = process.platform === "win32" ? child.toLowerCase() : child;
  const b = process.platform === "win32" ? parent.toLowerCase() : parent;
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

/** @param {string} rel */
const extOf = (rel) => path.extname(rel).toLowerCase();

/**
 * @param {string} repoRoot
 */
function createDocAccess(repoRoot) {
  const docRoot = path.join(repoRoot, DOC_DIR);
  let realDocRoot = "";
  try {
    realDocRoot = fs.realpathSync(docRoot);
  } catch {
    realDocRoot = "";
  }
  const isSecret = createSecretFilter(repoRoot);

  /** A path the tree may list and the reader may open (shape, extension and secret rules only). */
  function isListable(rel) {
    return ALLOWED_EXT.has(extOf(rel)) && !isSecret(rel);
  }

  /**
   * @param {unknown} rawRel
   * @returns {{ ok: true, rel: string, abs: string, size: number, mtime: number } | { ok: false, status: number, error: string }}
   */
  function resolve(rawRel) {
    const rel = normalizeRel(rawRel);
    if (!rel) return { ok: false, status: 400, error: "invalid path" };
    if (!realDocRoot) return { ok: false, status: 404, error: "the project has no doc folder" };
    if (!ALLOWED_EXT.has(extOf(rel))) return { ok: false, status: 403, error: "file type not served" };
    if (isSecret(rel)) return { ok: false, status: 403, error: "file not served" };
    const abs = path.join(docRoot, rel);
    let real = "";
    try {
      real = fs.realpathSync(abs);
    } catch {
      return { ok: false, status: 404, error: "file not found" };
    }
    if (!isInside(real, realDocRoot)) return { ok: false, status: 403, error: "path outside doc" };
    const stat = fs.statSync(real);
    if (!stat.isFile()) return { ok: false, status: 404, error: "file not found" };
    if (stat.size > MAX_BYTES) return { ok: false, status: 413, error: "file too large" };
    return { ok: true, rel, abs: real, size: stat.size, mtime: stat.mtimeMs };
  }

  /** @param {unknown} rawRel */
  function read(rawRel) {
    const hit = resolve(rawRel);
    if (!hit.ok) return hit;
    return { ...hit, text: fs.readFileSync(hit.abs, "utf8").replace(/^﻿/, "") };
  }

  return { docRoot, realDocRoot, isListable, resolve, read };
}

module.exports = { createDocAccess, normalizeRel, isInside, ALLOWED_EXT, MAX_BYTES, DOC_DIR };

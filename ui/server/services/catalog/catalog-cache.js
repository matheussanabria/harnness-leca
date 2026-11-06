// @ts-check
// In-memory caches for the catalog, so GET /api/catalog does not redo slow work on every call.
//
//  - File metadata: the parsed frontmatter of a SKILL.md or agent file, keyed by path and valid while the
//    file's mtime and size are unchanged. Editing a file changes its mtime (the parent folder's mtime does
//    not change on an edit), so the cache is per file. Folder listings are NOT cached: readdir is cheap and
//    it is what makes a new or removed skill show up on the next call.
//  - Sources: the registry scans every project repo (slow), so it is kept for a short time. A new project
//    repo can take up to SOURCES_TTL_MS to appear.
const fs = require("fs");
const { cleanBOM, parseFrontmatter } = require("../../../../tools/lib/skills/frontmatter");

const SOURCES_TTL_MS = 15000;

/** @type {Map<string, { mtimeMs: number, size: number, attrs: Record<string, string> }>} */
const files = new Map();
/** @type {Set<string>} */
let seen = new Set();
const stats = { hits: 0, misses: 0 };
/** @type {{ value: any, at: number } | null} */
let sourcesEntry = null;

/** Starts a catalog build: files not read until `endPass` are dropped from the cache. */
function beginPass() {
  seen = new Set();
}

function endPass() {
  for (const key of files.keys()) if (!seen.has(key)) files.delete(key);
}

/**
 * Frontmatter attributes of a file, re-read only when its mtime or size changed. Unreadable files give {}.
 * @param {string} file
 * @returns {Record<string, string>}
 */
function readMeta(file) {
  seen.add(file);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    files.delete(file);
    return {};
  }
  const cached = files.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    stats.hits += 1;
    return cached.attrs;
  }
  stats.misses += 1;
  let attrs = {};
  try {
    attrs = parseFrontmatter(cleanBOM(fs.readFileSync(file, "utf8"))).attributes;
  } catch {
    attrs = {};
  }
  files.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, attrs });
  return attrs;
}

/**
 * Source registry, recomputed after the TTL.
 * @template T
 * @param {() => T} compute
 * @param {{ ttlMs?: number, now?: () => number }} [opts]
 * @returns {T}
 */
function cachedSources(compute, opts = {}) {
  const now = (opts.now || Date.now)();
  const ttl = opts.ttlMs ?? SOURCES_TTL_MS;
  if (sourcesEntry && now - sourcesEntry.at < ttl) return sourcesEntry.value;
  const value = compute();
  sourcesEntry = { value, at: now };
  return value;
}

/** Clears everything (tests, or after a manual "refresh"). */
function reset() {
  files.clear();
  seen = new Set();
  sourcesEntry = null;
  stats.hits = 0;
  stats.misses = 0;
}

module.exports = { readMeta, beginPass, endPass, cachedSources, reset, stats, size: () => files.size, SOURCES_TTL_MS };

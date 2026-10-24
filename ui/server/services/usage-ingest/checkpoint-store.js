// @ts-check
// Persisted read offsets, one JSON file per project under its coordination folder. An entry is keyed
// by a hash of the transcript path (the path itself is not stored) and holds the committed byte offset
// plus the size and mtime seen when it was written, used to detect truncation or replacement.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE_NAME = "usage-ingest-checkpoints.json";

/** @param {string} file @returns {string} */
function keyOf(file) {
  return crypto.createHash("sha1").update(file).digest("hex").slice(0, 20);
}

/**
 * @typedef {{ offset: number, size: number, mtimeMs: number, seenAt: number }} Entry
 */

/**
 * @param {(slug: string) => string} coordinationDir
 * @param {number} ttlMs
 */
function createCheckpointStore(coordinationDir, ttlMs) {
  /** @type {Map<string, { entries: Record<string, Entry>, dirty: boolean }>} */
  const projects = new Map();
  const fileOf = (/** @type {string} */ slug) => path.join(coordinationDir(slug), FILE_NAME);

  function load(/** @type {string} */ slug) {
    let state = projects.get(slug);
    if (state) return state;
    state = { entries: {}, dirty: false };
    try {
      const raw = JSON.parse(fs.readFileSync(fileOf(slug), "utf8"));
      if (raw && raw.version === 1 && raw.files && typeof raw.files === "object") state.entries = raw.files;
    } catch {
      /* missing or corrupt checkpoint: start from scratch; the store idempotency makes the replay a no-op */
    }
    projects.set(slug, state);
    return state;
  }

  return {
    /** @returns {Entry | null} */
    get(/** @type {string} */ slug, /** @type {string} */ file) {
      return load(slug).entries[keyOf(file)] || null;
    },
    set(/** @type {string} */ slug, /** @type {string} */ file, /** @type {Entry} */ entry) {
      const state = load(slug);
      const prev = state.entries[keyOf(file)];
      if (prev && prev.offset === entry.offset && prev.size === entry.size && prev.mtimeMs === entry.mtimeMs) return;
      state.entries[keyOf(file)] = entry;
      state.dirty = true;
    },
    /** Writes dirty projects atomically (tmp + rename). Returns the number of files written. */
    flush(/** @type {number} */ nowMs) {
      let written = 0;
      for (const [slug, state] of projects) {
        if (!state.dirty) continue;
        for (const [k, e] of Object.entries(state.entries)) if (nowMs - e.seenAt > ttlMs) delete state.entries[k];
        const target = fileOf(slug);
        const tmp = `${target}.${process.pid}.tmp`;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(tmp, JSON.stringify({ version: 1, files: state.entries }));
        fs.renameSync(tmp, target);
        state.dirty = false;
        written += 1;
      }
      return written;
    },
  };
}

module.exports = { createCheckpointStore, keyOf, FILE_NAME };

// @ts-check
// Lists the Claude Code transcript files (metadata only: names, size, mtime). Layout:
//   <root>/<cwd-slug>/<sessionId>.jsonl
//   <root>/<cwd-slug>/<sessionId>/subagents/*.jsonl   (sidechain calls; sessionId is the PARENT session)
const fs = require("fs");
const path = require("path");

/**
 * @typedef {Object} TranscriptFile
 * @property {string} file
 * @property {string} hint        cwd-slug folder name, used for project attribution
 * @property {string} sessionId   native session id (parent session for subagent files)
 * @property {number} size
 * @property {number} mtimeMs
 */

/**
 * @param {string} root
 * @param {number} nowMs
 * @param {{ cold: Map<string, number>, coldAfterMs: number, coldSweepMs: number, isSettled: (file: string, size: number, hint: string) => boolean }} cache
 *   cold: path -> last stat instant for files that are old AND fully consumed (restat only every coldSweepMs)
 * @returns {TranscriptFile[]}
 */
function discover(root, nowMs, cache) {
  /** @type {TranscriptFile[]} */
  const out = [];
  const add = (/** @type {string} */ file, /** @type {string} */ hint, /** @type {string} */ sessionId) => {
    const checked = cache.cold.get(file);
    if (checked !== undefined && nowMs - checked < cache.coldSweepMs) return;
    try {
      const st = fs.statSync(file);
      if (nowMs - st.mtimeMs >= cache.coldAfterMs && cache.isSettled(file, st.size, hint)) cache.cold.set(file, nowMs);
      else cache.cold.delete(file);
      out.push({ file, hint, sessionId, size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      cache.cold.set(file, nowMs);
    }
  };
  const list = (/** @type {string} */ dir) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const proj of list(root)) {
    if (!proj.isDirectory()) continue;
    const projDir = path.join(root, proj.name);
    for (const entry of list(projDir)) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        add(path.join(projDir, entry.name), proj.name, entry.name.slice(0, -6));
      } else if (entry.isDirectory()) {
        const subDir = path.join(projDir, entry.name, "subagents");
        for (const sub of list(subDir)) if (sub.isFile() && sub.name.endsWith(".jsonl")) add(path.join(subDir, sub.name), proj.name, entry.name);
      }
    }
  }
  return out;
}

module.exports = { discover };

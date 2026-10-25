// @ts-check
// Lists Codex rollout files (metadata only). Layout: <codexHome>/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl.
const fs = require("fs");
const path = require("path");
const { ROLLOUT_RE } = require("../external-presence/presence-sources-db");

/**
 * @typedef {Object} RolloutFile
 * @property {string} file
 * @property {string} threadId
 * @property {number} size
 * @property {number} mtimeMs
 */

/** @param {string} dir @returns {import("fs").Dirent[]} */
function list(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * @param {string} codexHome
 * @param {number} nowMs
 * @param {{ cold: Map<string, number>, coldAfterMs: number, coldSweepMs: number, isSettled: (file: string, size: number, threadId: string) => boolean }} cache
 *   cold: path -> last stat instant for old, fully consumed files (re-statted only every coldSweepMs)
 * @returns {RolloutFile[]}
 */
function discoverRollouts(codexHome, nowMs, cache) {
  /** @type {RolloutFile[]} */
  const out = [];
  const base = path.join(codexHome, "sessions");
  for (const y of list(base)) {
    if (!y.isDirectory()) continue;
    for (const m of list(path.join(base, y.name))) {
      if (!m.isDirectory()) continue;
      for (const d of list(path.join(base, y.name, m.name))) {
        if (!d.isDirectory()) continue;
        const dir = path.join(base, y.name, m.name, d.name);
        for (const f of list(dir)) {
          const match = f.isFile() ? ROLLOUT_RE.exec(f.name) : null;
          if (!match) continue;
          const file = path.join(dir, f.name);
          const threadId = match[1].toLowerCase();
          const checked = cache.cold.get(file);
          if (checked !== undefined && nowMs - checked < cache.coldSweepMs) continue;
          try {
            const st = fs.statSync(file);
            if (nowMs - st.mtimeMs >= cache.coldAfterMs && cache.isSettled(file, st.size, threadId)) cache.cold.set(file, nowMs);
            else cache.cold.delete(file);
            out.push({ file, threadId, size: st.size, mtimeMs: st.mtimeMs });
          } catch {
            cache.cold.set(file, nowMs);
          }
        }
      }
    }
  }
  return out;
}

module.exports = { discoverRollouts };

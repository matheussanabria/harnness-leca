// @ts-check
// Reconcilia sessões Claude repetidas em várias pastas de workspace antes da importação.
const fs = require("fs");
const path = require("path");

/**
 * Seleciona uma fonte por sessionId: mais recente, depois maior, depois caminho lexical.
 * @param {string} sourceRoot
 * @param {string[]} dirs
 * @returns {{ dir: string, sessionIds: Set<string> }[]}
 */
function selectClaudeSources(sourceRoot, dirs) {
  const winners = new Map();
  for (const dir of [...dirs].sort()) {
    const fullDir = path.join(sourceRoot, dir);
    let files = [];
    try { files = fs.readdirSync(fullDir).filter((file) => file.endsWith(".jsonl")); } catch { continue; }
    for (const file of files) {
      const fullPath = path.join(fullDir, file);
      let stat;
      try { stat = fs.lstatSync(fullPath); } catch { continue; }
      if (!stat.isFile()) continue;
      const sessionId = file.slice(0, -".jsonl".length);
      const candidate = { dir, sessionId, mtimeMs: stat.mtimeMs, size: stat.size, fullPath };
      const current = winners.get(sessionId);
      const wins = !current || candidate.mtimeMs > current.mtimeMs ||
        (candidate.mtimeMs === current.mtimeMs && candidate.size > current.size) ||
        (candidate.mtimeMs === current.mtimeMs && candidate.size === current.size && candidate.fullPath.localeCompare(current.fullPath) > 0);
      if (wins) winners.set(sessionId, candidate);
    }
  }

  const byDir = new Map();
  for (const winner of winners.values()) {
    if (!byDir.has(winner.dir)) byDir.set(winner.dir, new Set());
    byDir.get(winner.dir).add(winner.sessionId);
  }
  return [...byDir].map(([dir, sessionIds]) => ({ dir, sessionIds }));
}

module.exports = { selectClaudeSources };

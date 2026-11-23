// @ts-check
// Ownership adapter for Canvas artifacts (types "canvas.<kind>", EP-25.04). It knows what a board is made of
// on disk (projects/<owner>/canvas/<uuid>.json plus the optional assets folder <uuid>/), how to move or copy
// it, which other boards mention it, and which caches to rebuild afterwards.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { canvasSourceKey } = require("./artifact-canvas");
const { rebuildIndex } = require("../canvas/canvas-index");
const { ArtifactError } = require("./artifact-errors");

const BOARD_PATH = /^([^/]+)\/canvas\/([0-9a-f-]{36})\.json$/;
const MAX_SCAN_BYTES = 4 * 1024 * 1024;

const canvasDir = (/** @type {string} */ projectsDir, /** @type {string} */ owner) => path.join(projectsDir, owner, "canvas");

/**
 * @param {{ artifact: { owner: string }, files: { path: string }[], projectsDir: string, destination: string, mode: "move"|"copy" }} input
 */
function plan({ artifact, files, projectsDir, destination, mode }) {
  const main = files.map((f) => BOARD_PATH.exec(f.path)).find(Boolean);
  if (!main) throw new ArtifactError("UNSUPPORTED_TYPE", "Este artefato não tem um arquivo de board reconhecível.");
  const boardId = main[2];
  const source = canvasDir(projectsDir, artifact.owner);
  const sourceJson = path.join(source, `${boardId}.json`);
  if (!fs.existsSync(sourceJson)) throw new ArtifactError("NOT_FOUND", "O arquivo do board não existe mais na origem.");
  const targetId = mode === "copy" ? crypto.randomUUID() : boardId;
  const target = canvasDir(projectsDir, destination);
  const targetJson = path.join(target, `${targetId}.json`);

  /** @type {import("./artifact-fs-ops").FileOp[]} */
  const ops = [];
  if (mode === "move") {
    ops.push({ kind: "move", from: sourceJson, to: targetJson });
  } else {
    const board = JSON.parse(fs.readFileSync(sourceJson, "utf8"));
    const now = new Date().toISOString();
    ops.push({ kind: "write", to: targetJson, content: JSON.stringify({ ...board, id: targetId, rev: 1, createdAt: now, updatedAt: now }) + "\n" });
  }
  const assets = path.join(source, boardId);
  if (fs.existsSync(assets)) ops.push({ kind: mode === "move" ? "move" : "copy", from: assets, to: path.join(target, targetId) });

  return {
    ops,
    destFiles: [{ path: `${destination}/canvas/${targetId}.json`, abs: targetJson }],
    sourceKey: canvasSourceKey(destination, targetId),
    reindex: [source, target],
  };
}

/** Boards of the same owner whose content mentions this board's id: they lose that link when it moves away. */
function references({ artifact, files, projectsDir }) {
  const main = files.map((f) => BOARD_PATH.exec(f.path)).find(Boolean);
  if (!main) return [];
  const boardId = main[2];
  const dir = canvasDir(projectsDir, artifact.owner);
  /** @type {{ kind: string, path: string, title: string }[]} */
  const found = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return found; }
  for (const name of names) {
    if (!name.endsWith(".json") || name === "index.json" || name === `${boardId}.json`) continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).size > MAX_SCAN_BYTES) continue;
      const raw = fs.readFileSync(file, "utf8");
      if (!raw.includes(boardId)) continue;
      found.push({ kind: "canvas-board", path: `${artifact.owner}/canvas/${name}`, title: String(JSON.parse(raw).title || name) });
    } catch { /* unreadable boards cannot be checked; they are not reported */ }
  }
  return found;
}

/** Rebuilds the per-project board indexes (a cache); never fails the operation. */
function afterApply(/** @type {{ reindex: string[] }} */ planned) {
  for (const dir of planned.reindex) {
    try { rebuildIndex(dir); } catch { /* the index is rebuilt on the next listing */ }
  }
}

module.exports = { plan, references, afterApply };

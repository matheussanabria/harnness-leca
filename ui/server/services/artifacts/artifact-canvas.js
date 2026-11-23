// @ts-check
// Pure mapping from a Canvas board file to an artifact registration (EP-25.03). Shared by the server hook
// and the one-time importer, so both produce the same type, source key and file list.
const crypto = require("crypto");
const fs = require("fs");

/** Board kinds registered as artifacts: type is "canvas.<kind>" (board, mindmap, diagram, flow). */
const typeOfKind = (/** @type {string} */ kind) => `canvas.${kind}`;

/** @param {string} slug @param {string} boardId */
const canvasSourceKey = (slug, boardId) => `canvas:${slug}:${boardId}`;

/** @param {string} file @returns {string|null} sha256 of the file bytes, or null when unreadable */
function hashFile(file) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return null;
  }
}

/**
 * @param {string} slug owner (a project slug or "_pessoal")
 * @param {{ id?: unknown, kind?: unknown, title?: unknown, createdAt?: unknown }} board parsed board JSON
 * @param {string} absoluteFile where the board lives, for the content hash
 * @returns {{ type: string, owner: string, title: string, sourceKey: string, createdAt?: string, files: { path: string, contentHash: string|null }[] } | null}
 *   null when the file is not a registrable board
 */
function canvasRegistration(slug, board, absoluteFile) {
  if (!board || typeof board.id !== "string" || typeof board.kind !== "string") return null;
  const title = typeof board.title === "string" && board.title.trim() ? board.title : "Sem titulo";
  return {
    type: typeOfKind(board.kind),
    owner: slug,
    title,
    sourceKey: canvasSourceKey(slug, board.id),
    createdAt: typeof board.createdAt === "string" ? board.createdAt : undefined,
    files: [{ path: `${slug}/canvas/${board.id}.json`, contentHash: hashFile(absoluteFile) }],
  };
}

module.exports = { typeOfKind, canvasSourceKey, canvasRegistration, hashFile };

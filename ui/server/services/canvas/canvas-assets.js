// @ts-check
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getProjects } = require("../../config");
const {
  assetNotFound,
  assetTooLarge,
  boardAssetsFull,
  emptyAsset,
  invalidAsset,
  invalidBody,
  storageError,
} = require("./canvas-errors");
const { assertRegularFile, atomicWrite, directoryExists, ensureDirectory } = require("./canvas-fs");
const { readBoard } = require("./canvas-store");
const {
  ASSET_FILE_RE,
  MAX_ASSET_BYTES,
  MAX_BOARD_ASSETS_BYTES,
  MIME_BY_EXT,
  detectAssetType,
  sanitizeAssetName,
  INLINE_EXTS,
} = require("./canvas-asset-types");
const { resolveProject, validateBoardId } = require("./canvas-validate");

const CANVAS_DIR = "canvas";
const ASSETS_DIR = "assets";

/**
 * Content-addressed assets live inside the board folder.
 * @param {string} slug
 * @param {string} boardId
 * @returns {string}
 */
function assetsDirectory(slug, boardId) {
  return path.join(getProjects(), slug, CANVAS_DIR, boardId, ASSETS_DIR);
}

/**
 * assetsDirectory after refusing a symlinked or non-directory board folder or assets folder.
 * @param {string} slug
 * @param {string} boardId
 * @returns {string}
 */
function guardedAssetsDirectory(slug, boardId) {
  const dir = assetsDirectory(slug, boardId);
  directoryExists(path.dirname(dir));
  directoryExists(dir);
  return dir;
}

/**
 * @param {string} slug
 * @param {string} boardId
 * @param {string} file
 * @returns {string}
 */
function assetUrl(slug, boardId, file) {
  return `/api/canvas/boards/${boardId}/assets/${file}?project=${encodeURIComponent(slug)}`;
}

/**
 * Sum of the regular files already stored for the board.
 * @param {string} dir
 * @returns {number}
 */
function storedBytes(dir) {
  /** @type {import("node:fs").Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return 0;
    throw storageError();
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw storageError();
    if (!entry.isFile()) continue;
    let stat;
    try {
      stat = fs.lstatSync(path.join(dir, entry.name));
    } catch {
      throw storageError();
    }
    if (stat.isSymbolicLink() || !stat.isFile()) throw storageError();
    total += stat.size;
  }
  return total;
}

/**
 * Store bytes as <sha256>.<ext>. Identical bytes are written once.
 * @param {unknown} project
 * @param {unknown} boardId
 * @param {Buffer} bytes
 * @param {unknown} name
 * @returns {{ created: boolean, asset: { hash: string, ext: string, size: number, mime: string, name: string, url: string, inline: boolean } }}
 */
function saveAsset(project, boardId, bytes, name) {
  const slug = resolveProject(project);
  const id = validateBoardId(boardId);
  readBoard(slug, id);

  if (!Buffer.isBuffer(bytes)) throw invalidBody();
  if (bytes.length === 0) throw emptyAsset();
  if (bytes.length > MAX_ASSET_BYTES) throw assetTooLarge();

  const type = detectAssetType(bytes, name);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const file = `${hash}.${type.ext}`;
  const dir = guardedAssetsDirectory(slug, id);
  const target = path.join(dir, file);

  let created = false;
  if (!assertRegularFile(target)) {
    // Deduped bytes do not consume quota again.
    if (storedBytes(dir) + bytes.length > MAX_BOARD_ASSETS_BYTES) throw boardAssetsFull();
    ensureDirectory(dir);
    atomicWrite(target, bytes);
    created = true;
  }

  return {
    created,
    asset: {
      hash,
      ext: type.ext,
      size: bytes.length,
      mime: type.mime,
      name: sanitizeAssetName(name),
      url: assetUrl(slug, id, file),
      inline: type.inline,
    },
  };
}

/**
 * Resolve one stored asset after validating the board and the file name.
 * @param {unknown} project
 * @param {unknown} boardId
 * @param {unknown} file
 * @returns {{ path: string, size: number, ext: string, mime: string, inline: boolean, hash: string }}
 */
function readAsset(project, boardId, file) {
  const slug = resolveProject(project);
  const id = validateBoardId(boardId);
  readBoard(slug, id);

  const match = typeof file === "string" ? ASSET_FILE_RE.exec(file) : null;
  if (!match) throw invalidAsset();
  const hash = match[1];
  const ext = match[2];

  const target = path.join(guardedAssetsDirectory(slug, id), match[0]);
  if (!assertRegularFile(target, MAX_ASSET_BYTES)) throw assetNotFound();

  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    throw storageError();
  }
  if (stat.isSymbolicLink() || !stat.isFile()) throw storageError();

  return {
    path: target,
    size: stat.size,
    ext,
    mime: MIME_BY_EXT[ext],
    inline: INLINE_EXTS.has(ext),
    hash,
  };
}

module.exports = { saveAsset, readAsset, assetsDirectory };

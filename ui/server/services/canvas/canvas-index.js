// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const { CanvasError, storageError } = require("./canvas-errors");
const { directoryExists, ensureDirectory, atomicWrite, readJsonFile } = require("./canvas-fs");
const { migrateBoard } = require("./canvas-migrate");
const { ID_RE, KINDS, MAX_BOARD_BYTES } = require("./canvas-validate");

const INDEX_VERSION = 1;
const INDEX_FILE = "index.json";
const INDEX_MAX_BYTES = 4 * 1024 * 1024;
const BOARD_FILE_MAX_BYTES = MAX_BOARD_BYTES + 64 * 1024;

/**
 * @param {string} dir
 * @returns {string}
 */
function indexFile(dir) {
  return path.join(dir, INDEX_FILE);
}

/**
 * @param {unknown} value
 * @returns {value is { v: number, boards: Array<Record<string, unknown>> }}
 */
function isValidIndex(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const index = /** @type {Record<string, unknown>} */ (value);
  if (index.v !== INDEX_VERSION || !Array.isArray(index.boards)) return false;
  return index.boards.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const board = /** @type {Record<string, unknown>} */ (entry);
    return typeof board.id === "string"
      && ID_RE.test(board.id)
      && typeof board.kind === "string"
      && KINDS.includes(board.kind)
      && typeof board.title === "string"
      && Number.isInteger(board.rev)
      && typeof board.updatedAt === "string";
  });
}

/**
 * @param {Record<string, any>} board
 * @returns {{ id: string, title: string, kind: string, rev: number, updatedAt: string }}
 */
function summaryOf(board) {
  return {
    id: board.id,
    title: board.title,
    kind: board.kind,
    rev: board.rev,
    updatedAt: board.updatedAt,
  };
}

/**
 * Corrupt or unknown files must not break the whole listing; security errors
 * (symlinks, unreadable directories) still propagate.
 * @param {unknown} error
 * @returns {boolean}
 */
function isSkippable(error) {
  if (!(error instanceof CanvasError)) return false;
  return error.code === "CORRUPT_FILE"
    || error.code === "INVALID_STORED_BOARD"
    || error.code === "UNSUPPORTED_VERSION";
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listBoardFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    throw storageError();
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const id = entry.name.slice(0, -".json".length);
    if (!ID_RE.test(id)) continue;
    files.push(path.join(dir, entry.name));
  }
  return files;
}

/**
 * @param {string} dir
 * @param {Array<Record<string, unknown>>} boards
 */
function writeIndex(dir, boards) {
  ensureDirectory(dir);
  atomicWrite(indexFile(dir), `${JSON.stringify({ v: INDEX_VERSION, boards })}\n`);
}

/**
 * @param {string} dir
 * @returns {Array<Record<string, unknown>>}
 */
function rebuildIndex(dir) {
  const boards = [];
  for (const file of listBoardFiles(dir)) {
    let raw;
    try {
      raw = readJsonFile(file, BOARD_FILE_MAX_BYTES);
    } catch (error) {
      if (isSkippable(error)) continue;
      throw error;
    }
    if (!raw) continue;
    try {
      boards.push(summaryOf(migrateBoard(raw).board));
    } catch (error) {
      if (isSkippable(error)) continue;
      throw error;
    }
  }
  writeIndex(dir, boards);
  return boards;
}

/**
 * The index is only a cache: one that outgrew its cap is rebuilt from the board files, not treated as a failure.
 * A symlink reports its own small size here, so it still reaches readJsonFile and is refused there.
 * @param {string} file
 * @returns {boolean}
 */
function isOversized(file) {
  try {
    return fs.lstatSync(file).size > INDEX_MAX_BYTES;
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 * @returns {Array<Record<string, unknown>>}
 */
function readIndex(dir) {
  if (!directoryExists(dir)) return [];
  if (isOversized(indexFile(dir))) return rebuildIndex(dir);
  let parsed;
  try {
    parsed = readJsonFile(indexFile(dir), INDEX_MAX_BYTES);
  } catch (error) {
    if (isSkippable(error) && /** @type {CanvasError} */ (error).code === "CORRUPT_FILE") {
      return rebuildIndex(dir);
    }
    throw error;
  }
  if (!parsed || !isValidIndex(parsed)) return rebuildIndex(dir);
  return parsed.boards.map((entry) => ({ ...entry }));
}

/**
 * @param {string} dir
 * @param {{ id: string, title: string, kind: string, rev: number, updatedAt: string }} entry
 * @returns {{ id: string, title: string, kind: string, rev: number, updatedAt: string }}
 */
function updateIndexEntry(dir, entry) {
  const boards = readIndex(dir);
  const at = boards.findIndex((board) => board.id === entry.id);
  if (at >= 0) boards[at] = entry;
  else boards.push(entry);
  writeIndex(dir, boards);
  return entry;
}

/**
 * @param {string} dir
 * @param {string} id
 */
function removeIndexEntry(dir, id) {
  const boards = readIndex(dir).filter((board) => board.id !== id);
  writeIndex(dir, boards);
}

module.exports = {
  INDEX_VERSION,
  INDEX_FILE,
  summaryOf,
  readIndex,
  rebuildIndex,
  updateIndexEntry,
  removeIndexEntry,
};

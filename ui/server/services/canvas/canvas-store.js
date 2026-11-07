// @ts-check
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getProjects } = require("../../config");
const {
  CanvasError,
  boardNotFound,
  invalidBody,
  revisionConflict,
  storageError,
} = require("./canvas-errors");
const {
  MAX_BOARD_BYTES,
  requireBody,
  resolveProject,
  validateBoardId,
  validateData,
  validateKind,
  validateRevision,
  validateTitle,
} = require("./canvas-validate");
const {
  atomicWrite,
  assertRegularFile,
  copyFileIfMissing,
  ensureDirectory,
  moveFile,
  readJsonFile,
} = require("./canvas-fs");
const { CURRENT_VERSION, migrateBoard } = require("./canvas-migrate");
const { checkKindData } = require("./canvas-kinds");
const {
  readIndex,
  removeIndexEntry,
  summaryOf,
  updateIndexEntry,
} = require("./canvas-index");

// Every fs call in this service is synchronous and no handler awaits between its read and its write, so with one
// server process the read, rev check and write of an update cannot interleave with another request.
const CANVAS_DIR = "canvas";
const TRASH_DIR = ".trash";
const BOARD_FILE_MAX_BYTES = MAX_BOARD_BYTES + 64 * 1024;

/**
 * @param {unknown} project
 * @returns {string}
 */
function canvasDirectory(project) {
  return path.join(getProjects(), resolveProject(project), CANVAS_DIR);
}

/**
 * @param {string} dir
 * @param {string} id
 * @returns {string}
 */
function boardFile(dir, id) {
  return path.join(dir, `${id}.json`);
}

/**
 * @param {Record<string, any>} board
 * @returns {string}
 */
function serialize(board) {
  return `${JSON.stringify(board)}\n`;
}

/**
 * Persist a migrated board, keeping a copy of the original version first.
 * @param {string} dir
 * @param {string} id
 * @param {{ board: Record<string, any>, from: number }} migrated
 */
function persistMigration(dir, id, migrated) {
  const file = boardFile(dir, id);
  copyFileIfMissing(file, path.join(dir, `${id}.v${migrated.from}.bak.json`));
  atomicWrite(file, serialize(migrated.board));
  updateIndexEntry(dir, summaryOf(migrated.board));
}

/**
 * Read one board file and migrate it when needed. Missing files return null.
 * @param {string} dir
 * @param {string} id
 * @returns {Record<string, any> | null}
 */
function readRecord(dir, id) {
  let raw;
  try {
    raw = readJsonFile(boardFile(dir, id), BOARD_FILE_MAX_BYTES);
  } catch (error) {
    if (error instanceof CanvasError && error.code === "CORRUPT_FILE") throw storageError();
    throw error;
  }
  if (raw === null) return null;

  let migrated;
  try {
    migrated = migrateBoard(raw);
  } catch (error) {
    if (error instanceof CanvasError && error.code === "UNSUPPORTED_VERSION") throw error;
    throw storageError();
  }
  if (migrated.changed) persistMigration(dir, id, migrated);
  return migrated.board;
}

/**
 * @param {unknown} project
 * @returns {{ boards: Array<Record<string, unknown>> }}
 */
function listBoards(project) {
  const dir = canvasDirectory(project);
  const boards = readIndex(dir)
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { boards };
}

/**
 * @param {unknown} project
 * @param {unknown} input
 * @returns {Record<string, any>}
 */
function createBoard(project, input) {
  const dir = canvasDirectory(project);
  const body = requireBody(input);
  const kind = validateKind(body.kind);
  const title = validateTitle(body.title);
  const data = body.data === undefined ? {} : checkKindData(kind, validateData(body.data), { allowBlank: true });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const board = {
    v: CURRENT_VERSION,
    id,
    kind,
    title,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    data,
  };

  ensureDirectory(dir);
  const file = boardFile(dir, id);
  if (assertRegularFile(file, BOARD_FILE_MAX_BYTES)) throw storageError();
  atomicWrite(file, serialize(board));
  updateIndexEntry(dir, summaryOf(board));
  return board;
}

/**
 * @param {unknown} project
 * @param {unknown} id
 * @returns {Record<string, any>}
 */
function readBoard(project, id) {
  const dir = canvasDirectory(project);
  const boardId = validateBoardId(id);
  const board = readRecord(dir, boardId);
  if (!board) throw boardNotFound(boardId);
  return board;
}

/**
 * @param {unknown} project
 * @param {unknown} id
 * @param {unknown} input
 * @returns {Record<string, any>}
 */
function updateBoard(project, id, input) {
  const dir = canvasDirectory(project);
  const boardId = validateBoardId(id);
  const body = requireBody(input);
  const rev = validateRevision(body.rev);

  const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
  const hasData = Object.prototype.hasOwnProperty.call(body, "data");
  if (!hasTitle && !hasData) throw invalidBody();
  const title = hasTitle ? validateTitle(body.title) : null;
  const data = hasData ? validateData(body.data) : null;

  const current = readRecord(dir, boardId);
  if (!current) throw boardNotFound(boardId);
  if (current.rev !== rev) throw revisionConflict(current.rev);
  if (data !== null) checkKindData(current.kind, data);

  const updatedAt = new Date().toISOString();
  const next = {
    ...current,
    v: CURRENT_VERSION,
    rev: current.rev + 1,
    updatedAt,
    title: title === null ? current.title : title,
    data: data === null ? current.data : data,
  };
  atomicWrite(boardFile(dir, boardId), serialize(next));
  updateIndexEntry(dir, summaryOf(next));
  return next;
}

/**
 * @param {string} target
 * @returns {boolean}
 */
function pathExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return false;
    throw storageError();
  }
}

/**
 * Move canvas/<boardId>/ (the assets folder) into the trash when it exists.
 * @param {string} dir
 * @param {string} boardId
 * @param {number} stamp
 */
function moveBoardDirectory(dir, boardId, stamp) {
  const source = path.join(dir, boardId);
  let stat;
  try {
    stat = fs.lstatSync(source);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return;
    throw storageError();
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageError();

  const destination = path.join(dir, TRASH_DIR, `${boardId}-${stamp}-assets`);
  if (pathExists(destination)) throw storageError();
  ensureDirectory(path.join(dir, TRASH_DIR));
  try {
    fs.renameSync(source, destination);
  } catch {
    throw storageError();
  }
}

/**
 * @param {unknown} project
 * @param {unknown} id
 * @returns {{ ok: true, id: string }}
 */
function deleteBoard(project, id) {
  const dir = canvasDirectory(project);
  const boardId = validateBoardId(id);
  const board = readRecord(dir, boardId);
  if (!board) throw boardNotFound(boardId);

  const stamp = Date.now();
  const destination = path.join(dir, TRASH_DIR, `${boardId}-${stamp}.json`);
  moveFile(boardFile(dir, boardId), destination);
  // Drop the index entry before the assets move: if that move fails, the listing must not show a board with no file.
  removeIndexEntry(dir, boardId);
  moveBoardDirectory(dir, boardId, stamp);
  return { ok: true, id: boardId };
}

module.exports = {
  listBoards,
  createBoard,
  readBoard,
  updateBoard,
  deleteBoard,
};

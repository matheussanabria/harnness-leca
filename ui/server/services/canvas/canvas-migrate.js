// @ts-check
const { invalidStoredBoard, unsupportedVersion } = require("./canvas-errors");
const { KINDS, ID_RE } = require("./canvas-validate");

const CURRENT_VERSION = 1;

/**
 * Pure migrators indexed by the version they upgrade from.
 * Each function receives a board at version N and returns a board at N + 1.
 * @type {Record<number, (board: Record<string, any>) => Record<string, any>>}
 */
const MIGRATORS = {};

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Upgrade a stored board to `targetVersion` (CURRENT_VERSION in production) and validate its core shape.
 * The last two parameters exist so tests can exercise a multi-step chain before a second schema version exists.
 * @param {unknown} raw
 * @param {Record<number, (board: Record<string, any>) => Record<string, any>>} [migrators]
 * @param {number} [targetVersion]
 * @returns {{ board: Record<string, any>, from: number, changed: boolean }}
 */
function migrateBoard(raw, migrators = MIGRATORS, targetVersion = CURRENT_VERSION) {
  if (!isPlainObject(raw)) throw invalidStoredBoard();

  const from = raw.v === undefined ? targetVersion : raw.v;
  if (!Number.isInteger(from) || from < 1) throw invalidStoredBoard();
  if (from > targetVersion) throw unsupportedVersion(from);

  let board = raw;
  let version = from;
  while (version < targetVersion) {
    const upgrade = migrators[version];
    if (typeof upgrade !== "function") throw unsupportedVersion(from);
    board = upgrade(board);
    if (!isPlainObject(board)) throw invalidStoredBoard();
    version += 1;
  }

  if (typeof board.id !== "string" || !ID_RE.test(board.id)) throw invalidStoredBoard();
  if (typeof board.kind !== "string" || !KINDS.includes(board.kind)) throw invalidStoredBoard();
  if (!isPlainObject(board.data)) throw invalidStoredBoard();

  const title = typeof board.title === "string" ? board.title : "";
  const rev = Number.isInteger(board.rev) && board.rev >= 1 ? board.rev : 1;
  const normalized = {
    v: targetVersion,
    id: board.id,
    kind: board.kind,
    title,
    rev,
    createdAt: typeof board.createdAt === "string" ? board.createdAt : new Date(0).toISOString(),
    updatedAt: typeof board.updatedAt === "string" ? board.updatedAt : new Date(0).toISOString(),
    data: board.data,
  };

  return { board: normalized, from, changed: version !== from };
}

module.exports = {
  CURRENT_VERSION,
  MIGRATORS,
  migrateBoard,
};

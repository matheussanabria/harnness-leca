// @ts-check
const { slugs } = require("../../config");
const {
  invalidBody,
  invalidData,
  invalidId,
  invalidKind,
  invalidTitle,
  boardTooLarge,
  projectNotFound,
  projectRequired,
  revisionRequired,
} = require("./canvas-errors");

const { KINDS } = require("./canvas-kinds");

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_TITLE_LENGTH = 120;
const MAX_BOARD_BYTES = 4 * 1024 * 1024;
// C0 controls plus DEL; tabs and line breaks are also rejected in a title.
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/**
 * @param {unknown} value
 * @returns {string}
 */
function validateBoardId(value) {
  if (typeof value !== "string" || !ID_RE.test(value)) throw invalidId();
  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function validateKind(value) {
  if (typeof value !== "string" || !KINDS.includes(value)) throw invalidKind();
  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function validateTitle(value) {
  if (typeof value !== "string" || CONTROL_RE.test(value)) throw invalidTitle();
  const title = value.trim();
  if (title.length < 1 || title.length > MAX_TITLE_LENGTH) throw invalidTitle();
  return title;
}

/**
 * The server treats board content as opaque JSON, but it still has to be a
 * plain object that can be serialized within the size budget.
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function validateData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidData();
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    throw invalidData();
  }
  if (typeof text !== "string") throw invalidData();
  if (Buffer.byteLength(text, "utf8") > MAX_BOARD_BYTES) throw boardTooLarge();
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function requireBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidBody();
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function validateRevision(value) {
  const rev = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(rev) || /** @type {number} */ (rev) < 1) throw revisionRequired();
  return /** @type {number} */ (rev);
}

/**
 * Query string wins over the JSON body field; blank values count as absent.
 * @param {unknown} queryProject
 * @param {unknown} bodyProject
 * @returns {string}
 */
function resolveProject(queryProject, bodyProject) {
  const fromQuery = typeof queryProject === "string" ? queryProject.trim() : "";
  const fromBody = typeof bodyProject === "string" ? bodyProject.trim() : "";
  const project = fromQuery || fromBody;
  if (!project) throw projectRequired();
  if (!slugs().includes(project)) throw projectNotFound(project);
  return project;
}

module.exports = {
  ID_RE,
  KINDS,
  MAX_TITLE_LENGTH,
  MAX_BOARD_BYTES,
  validateBoardId,
  validateKind,
  validateTitle,
  validateData,
  validateRevision,
  requireBody,
  resolveProject,
};

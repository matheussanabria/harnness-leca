// @ts-check
const { readJsonBody, send } = require("../config");
const { CanvasError, boardTooLarge, invalidJson } = require("../services/canvas/canvas-errors");
const {
  createBoard,
  deleteBoard,
  listBoards,
  readBoard,
  updateBoard,
} = require("../services/canvas/canvas-store");

/**
 * @param {import("node:http").ServerResponse} res
 * @param {unknown} error
 */
function fail(res, error) {
  if (error instanceof CanvasError) {
    return send(res, error.status, {
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  return send(res, 500, { error: "Falha ao processar o board.", code: "INTERNAL_ERROR" });
}

/**
 * @param {URL | undefined} url
 * @returns {string}
 */
function projectFrom(url) {
  return url && url.searchParams ? (url.searchParams.get("project") || "").trim() : "";
}

/**
 * Query string first, then the JSON body field project.
 * @param {URL | undefined} url
 * @param {unknown} body
 * @returns {unknown}
 */
function projectFor(url, body) {
  const query = projectFrom(url);
  if (query) return query;
  return body && typeof body === "object" && !Array.isArray(body)
    ? /** @type {Record<string, unknown>} */ (body).project
    : "";
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<unknown>}
 */
async function jsonBody(req) {
  try {
    return await readJsonBody(req);
  } catch (error) {
    if (error instanceof Error && error.message === "corpo muito grande") throw boardTooLarge();
    throw invalidJson();
  }
}

function apiCanvasBoardsList({ res, url }) {
  try {
    return send(res, 200, listBoards(projectFrom(url)));
  } catch (error) {
    return fail(res, error);
  }
}

async function apiCanvasBoardCreate({ req, res, url }) {
  try {
    const body = await jsonBody(req);
    return send(res, 201, { board: createBoard(projectFor(url, body), body) });
  } catch (error) {
    return fail(res, error);
  }
}

function apiCanvasBoardGet({ res, params, url }) {
  try {
    return send(res, 200, { board: readBoard(projectFrom(url), params[0]) });
  } catch (error) {
    return fail(res, error);
  }
}

async function apiCanvasBoardUpdate({ req, res, params, url }) {
  try {
    const body = await jsonBody(req);
    return send(res, 200, { board: updateBoard(projectFor(url, body), params[0], body) });
  } catch (error) {
    return fail(res, error);
  }
}

function apiCanvasBoardDelete({ res, params, url }) {
  try {
    return send(res, 200, deleteBoard(projectFrom(url), params[0]));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = {
  apiCanvasBoardsList,
  apiCanvasBoardCreate,
  apiCanvasBoardGet,
  apiCanvasBoardUpdate,
  apiCanvasBoardDelete,
};

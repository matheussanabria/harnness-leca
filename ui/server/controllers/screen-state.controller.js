// @ts-check
const { send, readJsonBody } = require("../config");
const { getScreenCatalog } = require("../services/screen-state/registry");
const {
  ScreenStoreError,
  readScreenState,
  patchScreenState,
  readScreenHistory,
  appendScreenHistory,
} = require("../services/screen-state/store");

function fail(res, error) {
  if (error instanceof ScreenStoreError) {
    return send(res, error.status, {
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  return send(res, 500, { error: "Falha ao processar o estado da tela.", code: "INTERNAL_ERROR" });
}

function projectFrom(url) {
  return url && url.searchParams ? url.searchParams.get("project") || "" : "";
}

function apiScreensCatalog({ res }) {
  return send(res, 200, { screens: getScreenCatalog() });
}

function apiScreenStateGet({ res, params, url }) {
  try {
    return send(res, 200, readScreenState(params[0], projectFrom(url)));
  } catch (error) {
    return fail(res, error);
  }
}

function patchFromBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ScreenStoreError("Corpo da requisição inválido.", "INVALID_STATE", 400);
  }
  if (Object.prototype.hasOwnProperty.call(body, "state")) {
    if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
      throw new ScreenStoreError("O campo state deve ser um objeto.", "INVALID_STATE", 400);
    }
    return { patch: body.state, rev: body.rev };
  }
  const { rev, ...patch } = body;
  return { patch, rev };
}

async function apiScreenStatePatch({ req, res, params, url }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido.", code: "INVALID_JSON" });
  }
  try {
    const { patch, rev } = patchFromBody(body);
    return send(res, 200, patchScreenState(params[0], projectFrom(url), patch, rev));
  } catch (error) {
    return fail(res, error);
  }
}

function apiScreenHistoryGet({ res, params, url }) {
  try {
    const limit = url && url.searchParams ? url.searchParams.get("limit") : null;
    return send(res, 200, readScreenHistory(params[0], projectFrom(url), limit));
  } catch (error) {
    return fail(res, error);
  }
}

async function apiScreenHistoryPost({ req, res, params, url }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido.", code: "INVALID_JSON" });
  }
  try {
    const input = body && typeof body === "object" && body.entry && typeof body.entry === "object"
      ? body.entry
      : body;
    return send(res, 200, appendScreenHistory(params[0], projectFrom(url), input));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = {
  apiScreensCatalog,
  apiScreenStateGet,
  apiScreenStatePatch,
  apiScreenHistoryGet,
  apiScreenHistoryPost,
};

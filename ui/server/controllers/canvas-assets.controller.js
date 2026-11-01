// @ts-check
const fs = require("node:fs");
const { send } = require("../config");
const { CanvasError, storageError } = require("../services/canvas/canvas-errors");
const { MAX_ASSET_BYTES } = require("../services/canvas/canvas-asset-types");
const { readAsset, saveAsset } = require("../services/canvas/canvas-assets");
const { readBoard } = require("../services/canvas/canvas-store");
const { readBinaryBody } = require("../services/canvas/canvas-body");

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
  return send(res, 500, { error: "Falha ao processar o asset.", code: "INTERNAL_ERROR" });
}

/**
 * @param {URL | undefined} url
 * @returns {string}
 */
function projectFrom(url) {
  return url && url.searchParams ? (url.searchParams.get("project") || "").trim() : "";
}

/**
 * POST /api/canvas/boards/:id/assets?project=<slug>&name=<file name>
 * @param {{ req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, url?: URL, params: string[] }} ctx
 * @returns {Promise<unknown>}
 */
async function apiCanvasAssetUpload({ req, res, url, params }) {
  try {
    // Refuse an unknown project or board before buffering up to 25 MB of body.
    readBoard(projectFrom(url), params[0]);
    const bytes = await readBinaryBody(req, MAX_ASSET_BYTES);
    const name = url && url.searchParams ? url.searchParams.get("name") : null;
    const result = saveAsset(projectFrom(url), params[0], bytes, name);
    return send(res, result.created ? 201 : 200, { asset: result.asset });
  } catch (error) {
    return fail(res, error);
  }
}

/**
 * GET /api/canvas/boards/:id/assets/:file?project=<slug>
 * @param {{ res: import("node:http").ServerResponse, url?: URL, params: string[] }} ctx
 * @returns {unknown}
 */
function apiCanvasAssetGet({ res, url, params }) {
  try {
    const asset = readAsset(projectFrom(url), params[0], params[1]);
    let body;
    try {
      body = fs.readFileSync(asset.path);
    } catch {
      throw storageError();
    }
    const disposition = asset.inline
      ? "inline"
      : `attachment; filename="asset-${asset.hash.slice(0, 12)}.${asset.ext}"`;
    return send(res, 200, body, asset.mime, {
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": disposition,
    });
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = { apiCanvasAssetUpload, apiCanvasAssetGet };

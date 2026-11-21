// @ts-check
"use strict";
// GET/PUT /api/project/:slug/design/prototypes/:protoId/motion/:screenId (ADR-018, EP-24.01).
const fs = require("fs");
const path = require("path");
const { getProjects, send, postOk, readJsonBody } = require("../config");
const { readMotion, writeMotion, MotionError, MAX_BYTES } = require("../services/motion-store.service");
const History = require("../services/prototype-history.service");

/** @param {string} slug */
function projectDirOf(slug) {
  const dir = path.join(getProjects(), slug);
  if (!fs.existsSync(dir)) throw new MotionError(404, "project_not_found", `Project '${slug}' not found.`);
  return dir;
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {unknown} err
 */
function fail(res, err) {
  if (err instanceof MotionError) return send(res, err.status, { error: err.message, code: err.code, ...err.details });
  return send(res, 500, { error: "Unexpected error.", code: "internal_error" });
}

async function apiMotionGet({ res, params: [slug, protoId, screenId] }) {
  try {
    return send(res, 200, { ok: true, ...readMotion(projectDirOf(slug), protoId, screenId) });
  } catch (err) {
    return fail(res, err);
  }
}

/** Body: { doc: motion@1, rev: string | null } */
async function apiMotionPut({ req, res, params: [slug, protoId, screenId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Access denied: PIN or localhost required.", code: "forbidden" });
  try {
    const projectDir = projectDirOf(slug);
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const tooLarge = err instanceof Error && err.message === "corpo muito grande";
      throw tooLarge
        ? new MotionError(413, "timeline_too_large", `Timeline is larger than ${MAX_BYTES / 1024} KB.`)
        : new MotionError(400, "invalid_json", "Body is not valid JSON.");
    }
    const { doc, rev } = /** @type {{ doc?: unknown, rev?: string | null }} */ (body || {});
    if (doc === undefined) throw new MotionError(400, "doc_required", "Body must contain doc.");
    // EP-24.06: edits from the keyframe panel enter the Atelier history, so its Ctrl+Z / Ctrl+Y undo and redo them.
    const label = typeof (/** @type {any} */ (body)).label === "string" ? String(/** @type {any} */ (body).label).slice(0, 80) : "Animação editada";
    const saved = History.withHistory(projectDir, protoId, { label, kind: "motion", detail: `screens/${screenId}.motion.json` },
      () => writeMotion(projectDir, protoId, screenId, doc, { rev }));
    return send(res, 200, { ok: true, ...saved });
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = { apiMotionGet, apiMotionPut };

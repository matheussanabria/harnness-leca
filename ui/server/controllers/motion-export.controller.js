// @ts-check
"use strict";
// Motion export endpoints (EP-24.05): create a job, poll it, download the file, cancel it, and list the formats
// this machine can encode. The headless browser only opens this server's own render URL (built from validated ids).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getProjects, send, postOk, readJsonBody } = require("../config");
const { readMotion, MotionError } = require("../services/motion-store.service");
const { createExportQueue, cleanupExports } = require("../services/motion-export-queue.service");
const { runExport, availableFormats, EXTENSIONS } = require("../services/motion-export-run.service");

const FORMATS = new Set(["webm", "mp4", "gif"]);
let formatsCache = null;

const queue = createExportQueue({
  run: (job, ctx) => runExport({ ...job.runSpec, signal: ctx.signal, onProgress: ctx.onProgress }),
});

/** @param {string} slug */
function projectDirOf(slug) {
  const dir = path.join(getProjects(), slug);
  if (!fs.existsSync(dir)) throw new MotionError(404, "project_not_found", `Project '${slug}' not found.`);
  return dir;
}

/** @param {import("node:http").ServerResponse} res @param {unknown} err */
function fail(res, err) {
  if (err instanceof MotionError) return send(res, err.status, { error: err.message, code: err.code, ...err.details });
  return send(res, 500, { error: String(/** @type {Error} */ (err)?.message || err).slice(0, 300), code: "internal_error" });
}

/** Public view of a job (no paths). @param {any} job */
const view = (job) => ({ id: job.id, status: job.status, format: job.format, frame: job.frame, total: job.total, bytes: job.bytes, error: job.error });

/** @param {any} body @param {any} doc */
function exportOptions(body, doc) {
  const format = String(body?.format || "webm");
  if (!FORMATS.has(format)) throw new MotionError(400, "invalid_format", "format must be webm, mp4 or gif.");
  const fps = body?.fps === undefined ? (format === "gif" ? Math.min(15, doc.fps) : doc.fps) : Number(body.fps);
  if (!Number.isInteger(fps) || fps < 1 || fps > (format === "gif" ? 30 : 60)) throw new MotionError(400, "invalid_fps", `fps must be an integer from 1 to ${format === "gif" ? 30 : 60}.`);
  const scale = body?.scale === undefined ? (format === "gif" ? 0.5 : 1) : Number(body.scale);
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 2) throw new MotionError(400, "invalid_scale", "scale must be between 0.25 and 2.");
  return { format, fps, scale };
}

/** POST .../prototypes/:protoId/motion/:screenId/export  body { format, fps?, scale? } */
async function apiMotionExportCreate({ req, res, params: [slug, protoId, screenId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Access denied: PIN or localhost required.", code: "forbidden" });
  try {
    const projectDir = projectDirOf(slug);
    const { doc } = readMotion(projectDir, protoId, screenId);
    if (!doc) throw new MotionError(404, "no_timeline", `Screen '${screenId}' has no timeline.`);
    const body = await readJsonBody(req).catch(() => { throw new MotionError(400, "invalid_json", "Body is not valid JSON."); });
    const opts = exportOptions(body, doc);
    const outDir = path.join(projectDir, "design", "exports");
    fs.mkdirSync(outDir, { recursive: true });
    cleanupExports(outDir, Date.now());
    const port = /** @type {number} */ (req.socket.localPort);
    const base = `http://127.0.0.1:${port}`;
    const enc = encodeURIComponent;
    // runSpec goes in with the job: enqueue may start it right away.
    const runSpec = {
      renderUrl: `${base}/api/project/${enc(slug)}/design/prototypes/${enc(protoId)}/render/${enc(screenId)}`,
      port, doc, ...opts, outFile: path.join(outDir, `${protoId}-${screenId}-${crypto.randomBytes(4).toString("hex")}.${EXTENSIONS[opts.format]}`),
    };
    const job = queue.enqueue(/** @type {any} */ ({ slug, protoId, screen: screenId, ...opts, runSpec }));
    return send(res, 202, { ok: true, job: view(job) });
  } catch (err) {
    return fail(res, err);
  }
}

/** @param {string} slug @param {string} id */
function jobOf(slug, id) {
  const job = queue.get(id);
  if (!job || job.slug !== slug) throw new MotionError(404, "job_not_found", "Export job not found.");
  return job;
}

/** GET /api/project/:slug/design/motion/export/:jobId */
async function apiMotionExportStatus({ res, params: [slug, id] }) {
  try { return send(res, 200, { ok: true, job: view(jobOf(slug, id)) }); } catch (err) { return fail(res, err); }
}

/** DELETE /api/project/:slug/design/motion/export/:jobId */
async function apiMotionExportCancel({ req, res, params: [slug, id] }) {
  if (!postOk(req)) return send(res, 403, { error: "Access denied: PIN or localhost required.", code: "forbidden" });
  try {
    jobOf(slug, id);
    return send(res, 200, { ok: true, cancelled: queue.cancel(id) });
  } catch (err) {
    return fail(res, err);
  }
}

/** GET /api/project/:slug/design/motion/export/:jobId/file */
async function apiMotionExportFile({ res, params: [slug, id] }) {
  try {
    const job = jobOf(slug, id);
    if (job.status !== "done" || !job.file || !fs.existsSync(job.file)) throw new MotionError(404, "file_not_ready", "The export file is not available.");
    const name = path.basename(job.file);
    res.writeHead(200, { "Content-Type": job.mime || "application/octet-stream", "Content-Length": fs.statSync(job.file).size, "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff" });
    return fs.createReadStream(job.file).pipe(res);
  } catch (err) {
    return fail(res, err);
  }
}

/** GET /api/project/:slug/design/motion/export-formats: what this machine can encode (probed once per process). */
async function apiMotionExportFormats({ res, params: [slug] }) {
  try {
    projectDirOf(slug);
    formatsCache = formatsCache || probeFormats().catch((err) => { formatsCache = null; throw err; });
    return send(res, 200, { ok: true, formats: await formatsCache });
  } catch (err) {
    return fail(res, err);
  }
}

async function probeFormats() {
  const { launchBrowser } = require("../../../tools/atelier-pilot/lib/browser");
  const { openEncoder } = require("../services/motion-export-encode.service");
  const { browser } = await launchBrowser();
  try {
    const encoder = await openEncoder(browser, { port: 9 });
    return availableFormats(await encoder.probe(1920, 1080));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

module.exports = { apiMotionExportCreate, apiMotionExportStatus, apiMotionExportCancel, apiMotionExportFile, apiMotionExportFormats, exportOptions, queue };

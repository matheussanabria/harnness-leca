// @ts-check
"use strict";
/**
 * Motion export jobs (EP-24.05): one running job per project, the rest wait (queued); cancel, 10-minute timeout,
 * and files older than 24 h removed from design/exports when a new job is created. The runner is injected so the
 * queue rules are tested without a browser.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TIMEOUT_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEEP_FINISHED = 50;

/**
 * @typedef {{ id: string, slug: string, protoId: string, screen: string, format: string, fps: number, scale: number,
 *   status: "queued" | "running" | "done" | "error" | "cancelled", frame: number, total: number, error?: string,
 *   file?: string, bytes?: number, mime?: string, createdAt: number, finishedAt?: number }} ExportJob
 */

/**
 * Deletes exported files older than maxAge in a directory; returns the removed names.
 * @param {string} dir @param {number} now @param {number} [maxAge]
 */
function cleanupExports(dir, now, maxAge = MAX_AGE_MS) {
  /** @type {string[]} */ const removed = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return removed; }
  for (const name of names) {
    if (!/\.(mp4|webm|gif|tmp)$/.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const stat = fs.lstatSync(file);
      if (stat.isFile() && now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(file);
        removed.push(name);
      }
    } catch { /* raced with another cleanup */ }
  }
  return removed;
}

/**
 * @param {{ run: (job: ExportJob, ctx: { signal: AbortSignal, onProgress: (f: number, n: number) => void }) => Promise<{ file: string, bytes: number, mime: string }>,
 *   now?: () => number, timeoutMs?: number }} deps
 */
function createExportQueue(deps) {
  const now = deps.now || Date.now;
  const timeoutMs = deps.timeoutMs || TIMEOUT_MS;
  /** @type {Map<string, ExportJob>} */ const jobs = new Map();
  /** @type {Map<string, AbortController>} */ const controllers = new Map();
  /** @type {Map<string, Promise<void>>} */ const done = new Map();

  const runningFor = (/** @type {string} */ slug) => [...jobs.values()].some((j) => j.slug === slug && j.status === "running");

  function prune() {
    const finished = [...jobs.values()].filter((j) => j.finishedAt).sort((a, b) => /** @type {number} */ (a.finishedAt) - /** @type {number} */ (b.finishedAt));
    while (finished.length > KEEP_FINISHED) jobs.delete(/** @type {ExportJob} */ (finished.shift()).id);
  }

  /** @param {ExportJob} job */
  function finish(job, patch) {
    Object.assign(job, patch, { finishedAt: now() });
    controllers.delete(job.id);
    prune();
    pump(job.slug);
  }

  /** @param {ExportJob} job */
  async function start(job) {
    const controller = new AbortController();
    controllers.set(job.id, controller);
    job.status = "running";
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    timer.unref?.(); // the timeout must never keep the process alive on its own
    try {
      const result = await deps.run(job, { signal: controller.signal, onProgress: (f, n) => { job.frame = f; job.total = n; } });
      finish(job, { status: "done", file: result.file, bytes: result.bytes, mime: result.mime });
    } catch (err) {
      const reason = controller.signal.aborted ? String(controller.signal.reason || "cancelled") : "";
      if (reason === "cancelled") finish(job, { status: "cancelled" });
      else finish(job, { status: "error", error: reason === "timeout" ? "Export took longer than 10 minutes." : String(/** @type {Error} */ (err)?.message || err).slice(0, 300) });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Starts the oldest queued job of a project when none is running. @param {string} slug */
  function pump(slug) {
    if (runningFor(slug)) return;
    const next = [...jobs.values()].filter((j) => j.slug === slug && j.status === "queued").sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) done.set(next.id, start(next));
  }

  return {
    /** @param {Omit<ExportJob, "id" | "status" | "frame" | "total" | "createdAt">} spec @returns {ExportJob} */
    enqueue(spec) {
      const job = /** @type {ExportJob} */ ({ ...spec, id: crypto.randomBytes(6).toString("hex"), status: "queued", frame: 0, total: 0, createdAt: now() });
      jobs.set(job.id, job);
      pump(job.slug);
      return job;
    },
    /** @param {string} id */
    get: (id) => jobs.get(id) || null,
    /** Cancels a queued or running job; returns false when it already finished. @param {string} id */
    cancel(id) {
      const job = jobs.get(id);
      if (!job || job.finishedAt) return false;
      if (job.status === "queued") {
        finish(job, { status: "cancelled" });
        return true;
      }
      controllers.get(id)?.abort("cancelled");
      return true;
    },
    /** Resolves when the job's run settles (tests). @param {string} id */
    settled: (id) => done.get(id) || Promise.resolve(),
  };
}

module.exports = { createExportQueue, cleanupExports, TIMEOUT_MS, MAX_AGE_MS };

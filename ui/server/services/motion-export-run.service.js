// @ts-check
"use strict";
/**
 * One motion export (EP-24.05): capture each frame of a screen's timeline in headless Chrome and stream it into the
 * encoder page, one frame at a time, then write the file atomically. No ffmpeg: WebCodecs plus mediabunny or gifenc.
 */
const fs = require("fs");
const { openScreen } = require("./motion-export-capture.service");
const { openEncoder } = require("./motion-export-encode.service");

const DEFAULT_SIZE = { w: 1280, h: 720 };
const EXTENSIONS = { mp4: "mp4", webm: "webm", gif: "gif" };
const MIME = { mp4: "video/mp4", webm: "video/webm", gif: "image/gif" };

class ExportCancelled extends Error {
  constructor(reason = "cancelled") {
    super(`Export ${reason}.`);
    this.reason = reason;
  }
}

/** Video encoders need even sides. @param {number} n */
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Frame plan: frame i shows time i * 1000 / fps; a 1000 ms timeline at 24 fps has 24 frames (0 to 958 ms).
 * @param {number} duration @param {number} fps
 */
function framePlan(duration, fps) {
  const total = Math.max(1, Math.round((duration / 1000) * fps));
  return Array.from({ length: total }, (_, i) => Math.min(duration, (i * 1000) / fps));
}

/**
 * Output size from the timeline size and the scale.
 * @param {{ size?: { w: number, h: number } }} doc @param {number} scale
 */
function outputSize(doc, scale) {
  const size = doc && doc.size ? doc.size : DEFAULT_SIZE;
  return { viewport: { width: size.w, height: size.h }, width: even(size.w * scale), height: even(size.h * scale) };
}

/**
 * @param {{
 *   renderUrl: string, port: number, doc: any, format: "mp4" | "webm" | "gif", fps: number, scale: number,
 *   outFile: string, onProgress?: (frame: number, total: number) => void, signal?: AbortSignal,
 *   launch?: () => Promise<{ browser: import("playwright-core").Browser }>
 * }} spec
 * @returns {Promise<{ file: string, bytes: number, frames: number, width: number, height: number, mime: string }>}
 */
async function runExport(spec) {
  const launch = spec.launch || require("../../../tools/atelier-pilot/lib/browser").launchBrowser;
  const { signal } = spec;
  const check = () => { if (signal?.aborted) throw new ExportCancelled(String(signal.reason || "cancelled")); };
  const { viewport, width, height } = outputSize(spec.doc, spec.scale);
  const times = framePlan(Number(spec.doc.duration) || 0, spec.fps);
  check();
  const { browser } = await launch();
  /** @type {any} */ let screen = null;
  /** @type {any} */ let encoder = null;
  try {
    screen = await openScreen(browser, { url: spec.renderUrl, width: viewport.width, height: viewport.height, scale: spec.scale });
    encoder = await openEncoder(browser, { port: spec.port });
    await encoder.start({ format: spec.format, width, height, fps: spec.fps });
    for (let i = 0; i < times.length; i += 1) {
      check();
      await encoder.frame(await screen.shot(times[i]), i);
      spec.onProgress?.(i + 1, times.length);
    }
    check();
    const bytes = await encoder.finish();
    const tmp = `${spec.outFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, spec.outFile);
    return { file: spec.outFile, bytes: bytes.length, frames: times.length, width, height, mime: MIME[spec.format] };
  } catch (err) {
    if (encoder) await encoder.cancel();
    throw err;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Formats offered to the user from what the browser can encode. @param {{ mp4?: boolean, webm?: boolean }} probe */
function availableFormats(probe) {
  return ["webm", "mp4", "gif"].filter((f) => f === "gif" || Boolean(probe && probe[/** @type {"mp4"|"webm"} */ (f)]));
}

module.exports = { runExport, framePlan, outputSize, availableFormats, ExportCancelled, EXTENSIONS, MIME };

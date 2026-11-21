// @ts-check
"use strict";
/**
 * Encoder side of a motion export (EP-24.05): opens a page on a localhost origin (WebCodecs needs a secure context)
 * whose files are all served by page.route, so nothing reaches the network or the public server. The page runs
 * motion-export-encoder.browser.js with mediabunny (MP4/WebM) and gifenc (GIF).
 */
const fs = require("fs");
const path = require("path");

const ENCODER_FILE = path.join(__dirname, "motion-export-encoder.browser.js");
const PREFIX = "/__motion_encoder__/";

/** First existing file among node_modules of this checkout and of the main checkout (worktrees share it). */
function findModuleFile(/** @type {string[]} */ parts) {
  const roots = [path.resolve(__dirname, "..", "..", "..")];
  try {
    const { mainRepoRoot } = require("../../../tools/atelier-pilot/lib/repo-root");
    roots.push(mainRepoRoot());
  } catch { /* single checkout */ }
  for (const root of roots) {
    const file = path.join(root, "node_modules", ...parts);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Missing ${parts.join("/")}: run npm install.`);
}

/** @returns {Record<string, { file: string, type: string }>} */
function encoderAssets() {
  return {
    "index.html": { file: "", type: "text/html" },
    "encoder.js": { file: ENCODER_FILE, type: "text/javascript" },
    "mediabunny.mjs": { file: findModuleFile(["mediabunny", "dist", "bundles", "mediabunny.min.mjs"]), type: "text/javascript" },
    "gifenc.esm.js": { file: findModuleFile(["gifenc", "dist", "gifenc.esm.js"]), type: "text/javascript" },
  };
}

const INDEX_HTML = '<!doctype html><meta charset="utf-8"><title>encoder</title><script type="module" src="encoder.js"></script>';

/**
 * @param {import("playwright-core").Browser} browser
 * @param {{ port: number }} options localhost port used only as a secure origin; requests never leave the browser
 */
async function openEncoder(browser, { port }) {
  const origin = `http://localhost:${port}`;
  const assets = encoderAssets();
  const page = await browser.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const name = url.origin === origin && url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : "";
    const asset = assets[name];
    if (!asset) return route.abort();
    const body = asset.file ? fs.readFileSync(asset.file) : INDEX_HTML;
    return route.fulfill({ contentType: asset.type, body });
  });
  await page.goto(`${origin}${PREFIX}index.html`);
  await page.waitForFunction(() => /** @type {any} */ (window).__encoderReady === true, null, { timeout: 15000 });
  return {
    /** @returns {Promise<{ mp4: boolean, webm: boolean, gif: boolean }>} */
    probe: (width = 1280, height = 720) => page.evaluate(([w, h]) => /** @type {any} */ (window).__encoder.probe(w, h), [width, height]),
    /** @param {{ format: string, width: number, height: number, fps: number }} opts */
    start: (opts) => page.evaluate((o) => /** @type {any} */ (window).__encoder.start(o), opts),
    /** @param {Buffer} png @param {number} index */
    frame: (png, index) => page.evaluate(([b64, i]) => /** @type {any} */ (window).__encoder.frame(b64, i), [png.toString("base64"), index]),
    /** @returns {Promise<Buffer>} */
    finish: async () => Buffer.from(await page.evaluate(() => /** @type {any} */ (window).__encoder.finish()), "base64"),
    cancel: () => page.evaluate(() => /** @type {any} */ (window).__encoder.cancel()).catch(() => undefined),
    close: () => page.close().catch(() => undefined),
  };
}

module.exports = { openEncoder, findModuleFile, PREFIX };

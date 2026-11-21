// @ts-check
"use strict";
/**
 * Builds the motion block appended to a rendered screen (ADR-018, EP-24.02): the timeline as inert JSON plus the
 * runtime script. Returns "" when the screen has no timeline or the stored file is not valid motion@1, so screens
 * without motion render exactly as before.
 */
const fs = require("fs");
const path = require("path");
const { validateMotion } = require("./motion-schema.service");

const RUNTIME_FILE = path.resolve(__dirname, "..", "..", "public", "js", "modules", "prototype-bridge-motion.js");

// Built from char codes so the source file never holds raw line or paragraph separators.
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

/** JSON safe inside a <script> element: no "</script>", no HTML comment openers, no line separators. */
function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEP, "\\u2028")
    .replace(PARA_SEP, "\\u2029");
}

/**
 * Reads and validates the timeline that sits next to a screen file.
 * @param {string} screenFile absolute path of screens/<id>.html
 * @param {{ fs: typeof fs }} [deps]
 * @returns {object | null}
 */
function loadRenderableMotion(screenFile, deps = { fs }) {
  const motionFile = screenFile.replace(/\.html$/, ".motion.json");
  if (motionFile === screenFile || !deps.fs.existsSync(motionFile)) return null;
  try {
    const doc = JSON.parse(deps.fs.readFileSync(motionFile, "utf8"));
    return validateMotion(doc).ok ? doc : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} screenFile absolute path of screens/<id>.html
 * @param {string} nonce CSP nonce of the page
 * @param {{ fs: typeof fs }} [deps]
 * @returns {string} HTML to place after the bridge script, or ""
 */
function buildMotionBlock(screenFile, nonce, deps = { fs }) {
  const doc = loadRenderableMotion(screenFile, deps);
  if (!doc) return "";
  let runtime = "";
  try { runtime = deps.fs.readFileSync(RUNTIME_FILE, "utf8"); } catch { return ""; }
  return `<script type="application/json" id="harness-motion">${scriptSafeJson(doc)}</script>
  <script nonce="${nonce}">${runtime}</script>`;
}

module.exports = { buildMotionBlock, loadRenderableMotion, scriptSafeJson, RUNTIME_FILE };

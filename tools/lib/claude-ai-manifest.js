// @ts-check
// claude.ai export manifest (manifest-<...>.json, or the manifest-<...>.zip that wraps it).
// The export links only work inside the user's logged-in browser (the server gets HTTP 403), so the server never
// downloads them: the UI opens each link in the browser, the browser saves the zip (usually to Downloads), and
// collectManifest() then finds those zips - next to the manifest or in ~/Downloads, saved after the manifest was
// generated (older exports with the same name are ignored; "conversations-000 (1).zip" also counts).
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { readZipEntry } = require("./zip-read");

const CACHE_ROOT = path.join(os.tmpdir(), "harness-claude-ai-export");
const WANTED = new Set(["conversations", "design_chats"]);
const NAME_RE = /^manifest-.+\.(json|zip)$/i;
const FILE_RE = /^(conversations|design_chats)-\d+\.zip$/i;
const SKEW_MS = 10 * 60 * 1000; // clock tolerance between the manifest timestamp and the file mtime

const clean = (input) => String(input || "").trim().replace(/^"(.*)"$/, "$1");

/** True when the input points at a manifest file (json or its wrapping zip). */
function isManifest(input) {
  const p = path.resolve(clean(input));
  return NAME_RE.test(path.basename(p)) && fs.existsSync(p) && fs.statSync(p).isFile();
}

/** Parses and validates the manifest; returns only the chat files. */
function readManifest(input) {
  const p = path.resolve(clean(input));
  const raw = p.toLowerCase().endsWith(".zip")
    ? readZipEntry(p, (n) => /manifest-.+\.json$/i.test(path.posix.basename(n)))
    : fs.readFileSync(p);
  if (!raw) throw new Error("O zip do manifest não contém o manifest-*.json.");
  let m;
  try { m = JSON.parse(String(raw).replace(/^﻿/, "")); } catch { throw new Error("Manifest inválido (JSON ilegível)."); }
  if (!m || !Array.isArray(m.data_files)) throw new Error("Manifest inválido: sem data_files.");
  const files = m.data_files.filter((f) => f && WANTED.has(f.category)).map((f) => {
    const url = new URL(String(f.export_url || ""));
    if (url.protocol !== "https:" || url.hostname !== "claude.ai") throw new Error(`Link fora do claude.ai recusado: ${url.hostname}`);
    if (!FILE_RE.test(String(f.filename))) throw new Error(`Nome de arquivo inesperado no manifest: ${f.filename}`);
    return { url: url.href, filename: String(f.filename), category: String(f.category) };
  });
  if (!files.length) throw new Error("O manifest não lista conversations nem design_chats.");
  const createdMs = Date.parse(m.created_at);
  const key = crypto.createHash("sha1").update(`${m.created_at}|${files.map((f) => f.url).join("|")}`).digest("hex").slice(0, 16);
  return {
    createdAt: String(m.created_at || ""),
    createdMs: Number.isFinite(createdMs) ? createdMs : 0,
    files,
    folder: path.dirname(p),
    dir: path.join(CACHE_ROOT, `manifest-${key}`),
  };
}

/** Newest zip for `filename` saved after `sinceMs` in any of `folders` (browser renames: "name (1).zip"). */
function findSaved(filename, folders, sinceMs) {
  const stem = filename.replace(/\.zip$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${stem}( \\(\\d+\\))?\\.zip$`, "i");
  let best = null;
  for (const folder of folders) {
    let names = [];
    try { names = fs.readdirSync(folder); } catch { continue; }
    for (const n of names) {
      if (!re.test(n)) continue;
      const full = path.join(folder, n);
      const st = fs.statSync(full);
      if (!st.isFile() || st.mtimeMs < sinceMs - SKEW_MS) continue;
      if (!best || st.mtimeMs > best.mtimeMs) best = { path: full, mtimeMs: st.mtimeMs };
    }
  }
  return best && best.path;
}

/**
 * Finds the manifest's chat zips saved by the browser and copies them into the cache under their canonical names.
 * @param {string} input
 * @param {{ folders?: string[] }} [opts] where to look (default: next to the manifest and ~/Downloads)
 * @returns {{ ready: boolean, dir: string, found: string[], missing: { filename: string, url: string }[] }}
 */
function collectManifest(input, { folders } = {}) {
  const m = readManifest(input);
  const where = folders || [...new Set([m.folder, path.join(os.homedir(), "Downloads")])];
  const found = [], missing = [];
  for (const f of m.files) {
    const target = path.join(m.dir, f.filename);
    const src = findSaved(f.filename, where, m.createdMs);
    if (src) {
      fs.mkdirSync(m.dir, { recursive: true });
      const s = fs.statSync(src);
      const t = fs.existsSync(target) ? fs.statSync(target) : null;
      if (!t || t.size !== s.size || t.mtimeMs < s.mtimeMs) fs.copyFileSync(src, target);
      found.push(src);
    } else if (!fs.existsSync(target)) {
      missing.push({ filename: f.filename, url: f.url });
    }
  }
  return { ready: !missing.length, dir: m.dir, found, missing };
}

/** Cache folder with all the manifest's zips, or null when some are still missing. */
function manifestDir(input) {
  const { files, dir } = readManifest(input);
  return files.every((f) => fs.existsSync(path.join(dir, f.filename))) ? dir : null;
}

module.exports = { isManifest, readManifest, collectManifest, manifestDir };

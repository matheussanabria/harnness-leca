// @ts-check
// Locates the readable parts of a claude.ai data export: conversations.json files and design_chats/ folders.
// Accepts the extracted folder, the folder with the raw zips (conversations-000.zip, design_chats-000.zip)
// one of those zips, or the export manifest (see claude-ai-manifest.js). Raw zips are extracted once into a cache under the OS temp dir, keyed by name, size and mtime.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { extractZip } = require("./zip-read");
const { isManifest, manifestDir } = require("./claude-ai-manifest");

const ZIP_RE = /^(conversations|design_chats)-\d+\.zip$/i;
const CACHE_ROOT = path.join(os.tmpdir(), "harness-claude-ai-export");

/** Walks `base` up to `depth` levels and collects files named conversations.json and dirs named design_chats. */
function scan(base, depth, acc) {
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return acc; }
  for (const d of entries) {
    const full = path.join(base, d.name);
    if (d.isFile() && d.name === "conversations.json") acc.convFiles.push(full);
    else if (d.isDirectory() && d.name === "design_chats") acc.designDirs.push(full);
    else if (d.isDirectory() && depth > 0) scan(full, depth - 1, acc);
  }
  return acc;
}

/** Extracts the export zips found in `dir` into the cache and returns the cache folder. */
function extractZips(dir, zips) {
  const key = zips.map((z) => { const st = fs.statSync(path.join(dir, z)); return `${z}:${st.size}:${st.mtimeMs}`; }).sort().join("|");
  const cache = path.join(CACHE_ROOT, crypto.createHash("sha1").update(`${path.resolve(dir)}|${key}`).digest("hex").slice(0, 16));
  const done = path.join(cache, ".done");
  if (fs.existsSync(done)) return cache;
  fs.rmSync(cache, { recursive: true, force: true });
  for (const z of zips) {
    const kind = ZIP_RE.exec(z)?.[1].toLowerCase();
    const part = path.join(cache, z.replace(/\.zip$/i, ""));
    const json = (n) => n.toLowerCase().endsWith(".json");
    if (kind === "conversations") extractZip(path.join(dir, z), part, { filter: (n) => path.posix.basename(n) === "conversations.json" });
    else {
      // design chats may come flat (<uuid>.json) or under design_chats/; normalize to design_chats/<uuid>.json
      const target = path.join(part, "design_chats");
      const written = extractZip(path.join(dir, z), path.join(part, "raw"), { filter: json });
      fs.mkdirSync(target, { recursive: true });
      for (const f of written) fs.renameSync(f, path.join(target, path.basename(f)));
      fs.rmSync(path.join(part, "raw"), { recursive: true, force: true });
    }
  }
  fs.writeFileSync(done, new Date().toISOString());
  return cache;
}

/**
 * @param {string} input folder (extracted or with the raw zips), one export zip, or the export manifest
 *   (json or its zip); a manifest resolves to the folder where downloadManifest() saved its zips.
 * @returns {{ base: string, convFiles: string[], designDirs: string[], fromZips: string[] }}
 */
function locateExport(input) {
  let dir = path.resolve(String(input || "").trim().replace(/^"(.*)"$/, "$1"));
  if (!fs.existsSync(dir)) throw new Error(`Caminho não encontrado: ${dir}`);
  if (isManifest(dir)) {
    const cached = manifestDir(dir);
    if (!cached) throw new Error("Os zips deste manifest ainda não foram baixados.");
    dir = cached;
  } else if (fs.statSync(dir).isFile()) {
    if (!ZIP_RE.test(path.basename(dir))) throw new Error("Informe o manifest-*.json do export, a pasta com os zips ou um dos arquivos conversations-NNN.zip / design_chats-NNN.zip.");
    dir = path.dirname(dir);
  }
  const found = scan(dir, 3, { convFiles: [], designDirs: [] });
  const zips = fs.readdirSync(dir).filter((n) => ZIP_RE.test(n));
  if (zips.length) {
    const cached = scan(extractZips(dir, zips), 3, { convFiles: [], designDirs: [] });
    // Prefer what was extracted from the zips (it is the newest export); keep loose files only when no zip covers them.
    if (cached.convFiles.length) found.convFiles = cached.convFiles;
    if (cached.designDirs.length) found.designDirs = cached.designDirs;
  }
  if (!found.convFiles.length && !found.designDirs.length) {
    throw new Error("Nenhum conversations.json, design_chats/ ou zip do export (conversations-NNN.zip) nessa pasta.");
  }
  return { base: dir, ...found, fromZips: zips };
}

module.exports = { locateExport, CACHE_ROOT };

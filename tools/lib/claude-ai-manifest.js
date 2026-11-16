// @ts-check
// claude.ai export manifest (manifest-<...>.json, or the manifest-<...>.zip that wraps it): reads it and downloads
// only the chat zips (categories "conversations" and "design_chats") into a cache folder. Export links may stop
// working once used, so a file that was downloaded completely is never fetched again.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { readZipEntry } = require("./zip-read");

const CACHE_ROOT = path.join(os.tmpdir(), "harness-claude-ai-export");
const WANTED = new Set(["conversations", "design_chats"]);
const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const NAME_RE = /^manifest-.+\.(json|zip)$/i;
const FILE_RE = /^(conversations|design_chats)-\d+\.zip$/i;

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
    return { url: url.href, filename: String(f.filename), category: f.category };
  });
  if (!files.length) throw new Error("O manifest não lista conversations nem design_chats.");
  const key = crypto.createHash("sha1").update(`${m.created_at}|${files.map((f) => f.url).join("|")}`).digest("hex").slice(0, 16);
  return { createdAt: String(m.created_at || ""), files, dir: path.join(CACHE_ROOT, `manifest-${key}`) };
}

/** Folder that holds the manifest's downloaded zips, or null when they are not all there yet. */
function manifestDir(input) {
  const { files, dir } = readManifest(input);
  return files.every((f) => fs.existsSync(path.join(dir, f.filename))) ? dir : null;
}

function httpError(status, createdAt) {
  const age = createdAt ? (Date.now() - Date.parse(createdAt)) / 3600000 : 0;
  const late = age > 24 ? ` O manifest foi gerado há ${Math.floor(age)} h e os links valem 24 h: gere um export novo.` : "";
  if (status === 401 || status === 403) return `O claude.ai recusou o download (HTTP ${status}).${late || " O link pode exigir login ou já ter sido usado: abra-o no navegador e aponte para a pasta com os zips."}`;
  if (status === 404 || status === 410) return `Link expirado ou já usado (HTTP ${status}).${late}`;
  return `Falha no download (HTTP ${status}).${late}`;
}

/**
 * Downloads the chat zips listed in the manifest (skipping the ones already cached) and returns the cache folder.
 * @param {string} input
 * @param {{ fetchImpl?: typeof fetch, log?: (line: string) => void }} [opts]
 */
async function downloadManifest(input, { fetchImpl = fetch, log = () => {} } = {}) {
  const { files, dir, createdAt } = readManifest(input);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const out = path.join(dir, f.filename);
    if (fs.existsSync(out)) { log(`já baixado: ${f.filename}`); continue; }
    const res = await fetchImpl(f.url, { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`${f.filename}: ${httpError(res.status, createdAt)}`);
    const type = String(res.headers.get("content-type") || "");
    if (type.includes("text/html")) throw new Error(`${f.filename}: o claude.ai devolveu uma página em vez do zip (login ou link expirado). Abra o link no navegador e aponte para a pasta com os zips.`);
    const part = `${out}.part`;
    let bytes = 0;
    const counter = new Transform({
      transform(chunk, _enc, cb) { bytes += chunk.length; cb(bytes > MAX_BYTES ? new Error("arquivo acima de 2 GB") : null, chunk); },
    });
    try {
      await pipeline(Readable.fromWeb(/** @type {any} */ (res.body)), counter, fs.createWriteStream(part));
      const head = Buffer.alloc(2);
      const fd = fs.openSync(part, "r");
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head.toString("latin1") !== "PK") throw new Error(`${f.filename}: o conteúdo baixado não é um zip.`);
      fs.renameSync(part, out);
    } catch (err) {
      fs.rmSync(part, { force: true });
      throw err;
    }
    log(`baixado: ${f.filename} (${(bytes / 1048576).toFixed(1)} MB)`);
  }
  return dir;
}

module.exports = { isManifest, readManifest, manifestDir, downloadManifest };

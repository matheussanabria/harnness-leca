// @ts-check
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { isInside } = require("./design-layers.service");
const { recordImportedArtifact } = require("./artifact-metadata.service");

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FOLDER_DEPTH = 3;
const MAX_COLLISIONS = 500;

const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".heic", ".heif",
  ".pdf", ".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml",
  ".html", ".htm", ".css", ".js", ".ts", ".webm", ".ogg", ".oga", ".mp3",
  ".m4a", ".wav", ".mp4", ".aac",
]);

const MIME = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  // @ts-ignore
  error.expose = true;
  return error;
}

function sanitizeSegment(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\0]/g, "_")
    .replace(/[^\w.\-À-ÿ ]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeFile(value) {
  const original = String(value || "").replace(/\\/g, "/").split("/").pop() || "";
  const ext = path.extname(original).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw fail(415, "Tipo de arquivo não suportado.");
  const base = sanitizeSegment(path.basename(original, path.extname(original))) || "arquivo";
  return `${base}${ext}`;
}

function sanitizeFolder(value) {
  const raw = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  if (raw.includes("\0") || /^[a-z]:\//i.test(raw)) throw fail(400, "Pasta de destino inválida.");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length > MAX_FOLDER_DEPTH) throw fail(400, "A pasta excede a profundidade permitida.");
  const clean = parts.map((part) => {
    if (part === "." || part === "..") throw fail(400, "Pasta de destino inválida.");
    const segment = sanitizeSegment(part);
    if (!segment) throw fail(400, "Pasta de destino inválida.");
    return segment;
  });
  return clean.join("/");
}

function ensureRoot(projectDir) {
  const root = path.join(projectDir, "artifacts");
  if (!isInside(projectDir, root)) throw fail(400, "Destino inválido.");
  if (fs.existsSync(root)) {
    const stat = fs.lstatSync(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail(400, "Destino de artefatos inválido.");
    return root;
  }
  fs.mkdirSync(root);
  return root;
}

function ensureFolder(root, folder) {
  let current = root;
  for (const part of folder.split("/").filter(Boolean)) {
    current = path.join(current, part);
    if (!isInside(root, current)) throw fail(400, "Destino inválido.");
    if (fs.existsSync(current)) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail(400, "Destino inválido.");
      continue;
    }
    fs.mkdirSync(current);
  }
  return current;
}

/**
 * @param {import("http").IncomingMessage} req
 */
async function readBody(req) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw fail(413, "Arquivo maior que 25 MB.");
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) throw fail(413, "Arquivo maior que 25 MB.");
      chunks.push(Buffer.from(chunk));
    }
  } catch (err) {
    // @ts-ignore
    if (err?.status) throw err;
    throw fail(400, "Falha ao receber o arquivo.");
  }
  if (!size) throw fail(400, "Arquivo vazio.");
  return Buffer.concat(chunks);
}

function writeUnique(dir, name, buffer) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  for (let index = 0; index < MAX_COLLISIONS; index += 1) {
    const candidate = path.join(dir, index ? `${base}-${index}${ext}` : name);
    try {
      fs.writeFileSync(candidate, buffer, { flag: "wx" });
      return candidate;
    } catch (err) {
      // @ts-ignore
      if (err?.code !== "EEXIST") throw err;
    }
  }
  throw fail(409, "Não foi possível escolher um nome livre para o arquivo.");
}

/**
 * @param {string} projectDir
 * @param {{name: string, folder?: string, source?: string, req: import("http").IncomingMessage}} input
 */
async function importArtifact(projectDir, input) {
  try {
    const root = ensureRoot(projectDir);
    const folder = sanitizeFolder(input.folder || "");
    const name = sanitizeFile(input.name);
    const dir = ensureFolder(root, folder);
    const buffer = await readBody(input.req);
    const saved = writeUnique(dir, name, buffer);
    const rel = path.relative(projectDir, saved).replace(/\\/g, "/");
    const mime = MIME[path.extname(saved).toLowerCase()] || "application/octet-stream";
    let recorded;
    try {
      recorded = recordImportedArtifact(projectDir, {
        file: rel,
        originalName: input.name,
        source: input.source,
        size: buffer.length,
        mime,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      });
    } catch (err) {
      try { fs.rmSync(saved, { force: true }); } catch {}
      throw err;
    }
    return {
      ok: true,
      name: path.basename(saved),
      file: rel,
      folder,
      size: buffer.length,
      mime,
      kind: "imported",
      metadata: recorded.metadata,
    };
  } catch (err) {
    // @ts-ignore
    if (err?.expose) throw err;
    throw fail(500, "Falha ao importar o arquivo.");
  }
}

module.exports = { importArtifact, ALLOWED_EXTENSIONS, MAX_BYTES };

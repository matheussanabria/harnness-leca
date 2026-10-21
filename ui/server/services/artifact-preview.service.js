// @ts-check
const fs = require("fs");
const path = require("path");
const { isInside } = require("./design-layers.service");
const { readManifest } = require("./artifact-metadata.service");
const { ALLOWED_EXTENSIONS } = require("./artifact-import.service");

const MAX_TEXT_BYTES = 512 * 1024;
const MAX_RAW_BYTES = 25 * 1024 * 1024;

const TEXT_EXT = new Set([".md", ".txt", ".json", ".js", ".css", ".ts", ".xml", ".yaml", ".yml", ".csv", ".log"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".heic", ".heif", ".svg"]);

const MIME = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const RULES = {
  imported: { prefix: "artifacts/", exts: ALLOWED_EXTENSIONS },
  prototype: { prefix: "design/", exts: new Set([".html", ".htm"]) },
  atelier: { prefix: "design/prototypes/", exts: new Set([".json"]), test: (rel) => rel.endsWith("/proto.json") },
  chat: { prefix: "chats/", exts: new Set([".md"]) },
  extraction: { prefix: "context/", exts: new Set([".md"]), test: (rel) => /^context\/extraido-[^/]+\.md$/i.test(rel) },
  document: { prefix: "context/extraidos/documentos/", exts: new Set([".md", ".txt", ".html", ".htm"]) },
  response: { prefix: "context/extraidos/respostas/", exts: new Set([".md", ".txt", ".html", ".htm"]) },
};

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  return error;
}

function normalizeRel(value) {
  const rel = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (!rel || rel.includes("\0") || /^[a-z]:\//i.test(rel)) return "";
  const parts = rel.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return "";
  return rel;
}

function resolveSafe(projectDir, rel) {
  const abs = path.resolve(projectDir, rel);
  if (!isInside(projectDir, abs)) return null;
  try {
    let current = projectDir;
    const parts = rel.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
      if (index < parts.length - 1 && !stat.isDirectory()) return null;
      if (index === parts.length - 1 && !stat.isFile()) return null;
    }
    return abs;
  } catch {
    return null;
  }
}

function classify(ext) {
  if (TEXT_EXT.has(ext)) return "text";
  if (ext === ".html" || ext === ".htm") return "html";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "unsupported";
}

function languageFor(ext) {
  return {
    ".md": "markdown", ".json": "json", ".js": "javascript", ".ts": "typescript",
    ".css": "css", ".xml": "xml", ".yaml": "yaml", ".yml": "yaml", ".csv": "csv",
  }[ext] || "text";
}

function readHead(abs, limit) {
  let fd;
  try {
    fd = fs.openSync(abs, "r");
    const buffer = Buffer.alloc(limit);
    const read = fs.readSync(fd, buffer, 0, limit, 0);
    return buffer.subarray(0, read).toString("utf8").replace(/^\uFEFF/, "");
  } catch {
    throw fail(404, "Artefato não encontrado.");
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function resolveTarget(projectDir, kind, value, includeLocal) {
  const rule = RULES[kind];
  if (!rule) throw fail(400, "Tipo de artefato inválido.");
  const rel = normalizeRel(value);
  if (!rel) throw fail(400, "Arquivo de prévia inválido.");
  if (!rel.startsWith(rule.prefix)) throw fail(403, "Arquivo fora do escopo deste tipo de artefato.");
  const ext = path.extname(rel).toLowerCase();
  if (!rule.exts.has(ext) || (rule.test && !rule.test(rel))) {
    throw fail(403, "Extensão não permitida para este tipo de artefato.");
  }
  const abs = resolveSafe(projectDir, rel);
  if (!abs) throw fail(404, "Artefato não encontrado.");
  const stat = fs.lstatSync(abs);
  if (stat.size > MAX_RAW_BYTES) throw fail(413, "Arquivo grande demais para prévia.");

  let access = "project";
  /** @type {any} */
  let metadata = null;
  if (kind === "imported") {
    const loaded = readManifest(projectDir);
    if (loaded.error) throw fail(409, loaded.error);
    metadata = loaded.items[rel] || null;
    access = metadata?.access === "local" ? "local" : "project";
    if (access === "local" && !includeLocal) throw fail(404, "Artefato não encontrado.");
  }

  return {
    kind,
    file: rel,
    abs,
    ext,
    mime: MIME[ext] || "application/octet-stream",
    previewKind: classify(ext),
    size: stat.size,
    modifiedAt: new Date(stat.mtimeMs).toISOString(),
    access,
    metadata,
  };
}

/**
 * Monta a prévia segura de um artefato. Conteúdo binário não entra no JSON.
 * @param {string} projectDir
 * @param {{kind: string, file: string, includeLocal?: boolean}} input
 */
function buildArtifactPreview(projectDir, input) {
  const target = resolveTarget(projectDir, input.kind, input.file, input.includeLocal === true);
  const payload = {
    ok: true,
    kind: target.kind,
    file: target.file,
    previewKind: target.previewKind,
    mime: target.mime,
    size: target.size,
    modifiedAt: target.modifiedAt,
    access: target.access,
    metadata: target.metadata,
  };
  if (target.previewKind === "text") {
    payload.content = readHead(target.abs, MAX_TEXT_BYTES);
    payload.truncated = target.size > MAX_TEXT_BYTES;
    payload.language = languageFor(target.ext);
  } else if (target.previewKind === "unsupported") {
    payload.reason = "Este tipo de arquivo não tem prévia segura.";
  }
  return payload;
}

/**
 * Lê os bytes de uma prévia que pode ser exibida em iframe, imagem ou PDF.
 * @param {string} projectDir
 * @param {{kind: string, file: string, includeLocal?: boolean}} input
 */
function readArtifactPreviewRaw(projectDir, input) {
  const target = resolveTarget(projectDir, input.kind, input.file, input.includeLocal === true);
  if (!["html", "image", "pdf"].includes(target.previewKind)) {
    throw fail(400, "Este artefato não possui prévia binária.");
  }
  return {
    body: fs.readFileSync(target.abs),
    mime: target.mime,
    previewKind: target.previewKind,
    size: target.size,
  };
}

module.exports = {
  MAX_RAW_BYTES,
  MAX_TEXT_BYTES,
  buildArtifactPreview,
  readArtifactPreviewRaw,
};

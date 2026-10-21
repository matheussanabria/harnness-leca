// @ts-check
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { isInside } = require("./design-layers.service");

const MANIFEST_REL = "artifacts/.metadata.json";
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const ACCESS_LEVELS = new Set(["project", "local"]);
const SOURCES = new Set(["files", "folder"]);

function fail(status, message) {
  const error = new Error(message);
  // @ts-ignore
  error.status = status;
  // @ts-ignore
  error.expose = true;
  return error;
}

function artifactRoot(projectDir) {
  return path.join(projectDir, "artifacts");
}

function manifestPath(projectDir) {
  return path.join(projectDir, MANIFEST_REL);
}

function normalizeFile(value) {
  const rel = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (!rel || rel.includes("\0") || /^[a-z]:\//i.test(rel)) return "";
  if (!rel.startsWith("artifacts/")) return "";
  if (rel.split("/").some((part) => !part || part === "." || part === "..")) return "";
  return rel;
}

function safeText(value, max) {
  return String(value || "").replace(/[\0\r\n]/g, " ").trim().slice(0, max);
}

function safeDate(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function safeSha(value) {
  const sha = String(value || "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(sha) ? sha : "";
}

function safeSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function publicMetadata(entry) {
  return {
    origin: entry.origin === "existing" ? "existing" : "import",
    source: SOURCES.has(entry.source) ? entry.source : "files",
    originalName: path.basename(String(entry.originalName || "").replace(/\\/g, "/")).slice(0, 160),
    importedAt: safeDate(entry.importedAt),
    size: safeSize(entry.size),
    mime: safeText(entry.mime, 120),
    sha256: safeSha(entry.sha256),
    access: ACCESS_LEVELS.has(entry.access) ? entry.access : "project",
  };
}

function readManifest(projectDir) {
  const root = artifactRoot(projectDir);
  try {
    if (!fs.existsSync(root)) return { items: {}, error: "" };
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { items: {}, error: "Pasta de artefatos inválida." };
    }
    const abs = manifestPath(projectDir);
    if (!fs.existsSync(abs)) return { items: {}, error: "" };
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_MANIFEST_BYTES) {
      return { items: {}, error: "Manifesto de artefatos inválido." };
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, ""));
    if (raw?.version !== 1 || !raw.items || typeof raw.items !== "object" || Array.isArray(raw.items)) {
      return { items: {}, error: "Manifesto de artefatos inválido." };
    }
    const items = {};
    for (const [key, value] of Object.entries(raw.items)) {
      const file = normalizeFile(key);
      if (!file || file !== key || !value || typeof value !== "object") continue;
      items[file] = publicMetadata(/** @type {Record<string, unknown>} */ (value));
    }
    return { items, error: "" };
  } catch {
    return { items: {}, error: "Manifesto de artefatos inválido." };
  }
}

function resolveArtifactFile(projectDir, value) {
  const rel = normalizeFile(value);
  if (!rel) return null;
  const root = artifactRoot(projectDir);
  const abs = path.resolve(projectDir, rel);
  if (!isInside(root, abs)) return null;
  try {
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return null;
    let current = root;
    const parts = rel.split("/");
    for (let index = 1; index < parts.length; index += 1) {
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

function saveManifest(projectDir, items) {
  const root = artifactRoot(projectDir);
  try {
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("root");
    const abs = manifestPath(projectDir);
    if (fs.existsSync(abs)) {
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("manifest");
    }
    const temp = path.join(root, `.metadata.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    fs.writeFileSync(temp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    try {
      fs.renameSync(temp, abs);
    } catch {
      fs.copyFileSync(temp, abs);
      fs.rmSync(temp, { force: true });
    }
  } catch {
    throw fail(500, "Falha ao gravar os metadados do artefato.");
  }
}

function sha256File(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

/**
 * Registra um arquivo recém-importado. A chamada faz parte da importação: se falhar, o arquivo deve ser removido.
 * @param {string} projectDir
 * @param {{file: string, originalName?: string, source?: string, size?: number, mime?: string, sha256?: string}} input
 */
function recordImportedArtifact(projectDir, input) {
  const file = normalizeFile(input.file);
  if (!file) throw fail(400, "Arquivo de artefato inválido.");
  const abs = resolveArtifactFile(projectDir, file);
  if (!abs) throw fail(400, "Arquivo de artefato inválido.");
  const loaded = readManifest(projectDir);
  if (loaded.error) throw fail(500, loaded.error);
  if (Object.keys(loaded.items).length >= MAX_ENTRIES) throw fail(409, "Limite de metadados de artefatos atingido.");
  const stat = fs.lstatSync(abs);
  const entry = {
    origin: "import",
    source: input.source === "folder" ? "folder" : "files",
    originalName: path.basename(String(input.originalName || file).replace(/\\/g, "/")).slice(0, 160),
    importedAt: new Date().toISOString(),
    size: safeSize(input.size ?? stat.size),
    mime: safeText(input.mime, 120),
    sha256: safeSha(input.sha256) || sha256File(abs),
    access: "project",
  };
  loaded.items[file] = entry;
  saveManifest(projectDir, loaded.items);
  return { ok: true, file, metadata: publicMetadata(entry) };
}

/**
 * Altera o acesso de um artefato importado. O caminho precisa ser um arquivo real dentro de artifacts/.
 * @param {string} projectDir
 * @param {string} value
 * @param {string} access
 */
function updateArtifactAccess(projectDir, value, access) {
  if (!ACCESS_LEVELS.has(access)) throw fail(400, "Nível de acesso inválido.");
  const file = normalizeFile(value);
  const abs = file ? resolveArtifactFile(projectDir, file) : null;
  if (!abs) throw fail(400, "Arquivo de artefato inválido.");
  const loaded = readManifest(projectDir);
  if (loaded.error) throw fail(500, loaded.error);
  const stat = fs.lstatSync(abs);
  const current = loaded.items[file] || {
    origin: "existing",
    source: "files",
    originalName: path.basename(file),
    importedAt: "",
    size: stat.size,
    mime: "",
    sha256: "",
    access: "project",
  };
  const entry = { ...current, access };
  loaded.items[file] = entry;
  saveManifest(projectDir, loaded.items);
  return { ok: true, file, access, metadata: publicMetadata(entry) };
}

/**
 * Mescla origem e acesso aos itens importados e remove os "local" quando a origem não é loopback.
 * @param {string} projectDir
 * @param {any[]} items
 * @param {{includeLocal?: boolean}} [options]
 */
function applyArtifactMetadata(projectDir, items, options = {}) {
  const loaded = readManifest(projectDir);
  const warnings = loaded.error ? [loaded.error] : [];
  const includeLocal = options.includeLocal === true;
  const result = [];
  for (const item of items) {
    if (item.kind !== "imported") {
      result.push({ ...item, access: "project", metadata: null });
      continue;
    }
    const entry = loaded.items[normalizeFile(item.file)] || null;
    const access = entry?.access === "local" ? "local" : "project";
    if (access === "local" && !includeLocal) continue;
    result.push({ ...item, access, metadata: entry ? publicMetadata(entry) : null });
  }
  return { items: result, warnings };
}

module.exports = {
  MANIFEST_REL,
  applyArtifactMetadata,
  normalizeFile,
  readManifest,
  recordImportedArtifact,
  updateArtifactAccess,
};

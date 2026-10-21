// @ts-check
const fs = require("fs");
const path = require("path");
const { isInside } = require("./design-layers.service");
const { ALLOWED_EXTENSIONS } = require("./artifact-import.service");

const KINDS = ["prototype", "atelier", "chat", "extraction", "document", "response", "imported"];
const TITLE_BYTES = 8 * 1024;
const MAX_DEPTH = 3;

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

function toPosix(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeRel(value) {
  const rel = toPosix(value).replace(/^\.\//, "").replace(/^\/+/, "");
  if (!rel || rel.includes("\0") || /^[a-z]:\//i.test(rel)) return "";
  if (rel.split("/").some((part) => part === ".." || part === "")) return "";
  return rel;
}

function resolveInside(root, rel) {
  const clean = normalizeRel(rel);
  if (!clean) return null;
  const abs = path.resolve(root, clean);
  if (!isInside(root, abs)) return null;
  try {
    const realRoot = fs.realpathSync(root);
    let probe = abs;
    while (!fs.existsSync(probe) && probe !== root) probe = path.dirname(probe);
    const realProbe = fs.realpathSync(probe);
    if (realProbe !== realRoot && !isInside(realRoot, realProbe)) return null;
  } catch {
    return null;
  }
  return abs;
}

function safeId(value, fallback) {
  const id = String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

function isSafeHttpsUrl(value) {
  try {
    return typeof value === "string" && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function readHead(abs) {
  let fd;
  try {
    fd = fs.openSync(abs, "r");
    const buffer = Buffer.alloc(TITLE_BYTES);
    const read = fs.readSync(fd, buffer, 0, TITLE_BYTES, 0);
    return buffer.subarray(0, read).toString("utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function titleFrom(text, fallback) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] || "";
  const field = /^titulo:\s*(.+)$/im.exec(frontmatter)?.[1]
    || /^#\s+(.+)$/m.exec(text)?.[1]
    || "";
  const clean = field.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  return clean.slice(0, 160) || fallback;
}

function fileInfo(root, rel) {
  const clean = normalizeRel(rel);
  if (!clean) return { file: "", availability: "invalid" };
  const abs = resolveInside(root, clean);
  if (!abs) return { file: clean, availability: "invalid" };
  try {
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink() || !stat.isFile()) return { file: clean, availability: "invalid" };
    return {
      file: clean,
      availability: "local",
      size: stat.size,
      modifiedAt: new Date(stat.mtimeMs).toISOString(),
      mime: MIME[path.extname(clean).toLowerCase()] || "application/octet-stream",
    };
  } catch {
    return { file: clean, availability: "missing" };
  }
}

function listFiles(root, rel, exts) {
  const files = [];
  const walk = (current, depth) => {
    const abs = resolveInside(root, current);
    if (!abs) return;
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const child = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) walk(child, depth + 1);
      } else if (entry.isFile() && exts.has(path.extname(entry.name).toLowerCase())) {
        files.push(child);
      }
    }
  };
  walk(normalizeRel(rel), 0);
  return files;
}

function readJson(abs, warnings, label) {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    warnings.push(`${label} não pôde ser lido.`);
    return null;
  }
}

function scanDesign(projectDir, warnings) {
  const rel = "design/design.json";
  const info = fileInfo(projectDir, rel);
  if (info.availability !== "local") return [];
  const data = readJson(path.join(projectDir, rel), warnings, "design.json");
  if (!Array.isArray(data?.prototypes)) return [];

  return data.prototypes.map((raw, index) => {
    const id = safeId(raw?.id, `prototype-${index + 1}`);
    const file = typeof raw?.file === "string" ? normalizeRel(raw.file) : "";
    const externalUrl = isSafeHttpsUrl(raw?.externalUrl) ? raw.externalUrl : "";
    if (/^design\/prototypes\/[^/]+\/proto\.json$/.test(file)) return null;
    const info = file ? fileInfo(projectDir, file) : { file: "", availability: "invalid" };
    if (!file && externalUrl) info.availability = "external";
    return {
      key: `prototype:${id}`,
      id,
      title: String(raw?.title || id).slice(0, 160),
      kind: "prototype",
      origin: "design.json",
      externalUrl,
      ...info,
    };
  }).filter(Boolean);
}

function scanAteliers(projectDir, warnings) {
  const baseRel = "design/prototypes";
  const base = resolveInside(projectDir, baseRel);
  if (!base || !fs.existsSync(base)) return [];
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }

  const items = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const file = `${baseRel}/${entry.name}/proto.json`;
    const abs = resolveInside(projectDir, file);
    const info = fileInfo(projectDir, file);
    const raw = abs && info.availability === "local" ? readJson(abs, warnings, `${entry.name}/proto.json`) : null;
    const screens = raw?.screens;
    const screenCount = Array.isArray(screens) ? screens.length : screens && typeof screens === "object" ? Object.keys(screens).length : 0;
    const id = safeId(raw?.id || entry.name, entry.name);
    items.push({
      key: `atelier:${id}`,
      id,
      title: String(raw?.title || id).slice(0, 160),
      kind: "atelier",
      origin: "design/prototypes",
      version: Number(raw?.version) || 1,
      screenCount,
      sourceArtifact: raw?.metadata?.sourceArtifact || "",
      inspection: Boolean(raw?.metadata?.inspectionCopy),
      ...info,
    });
  }
  return items;
}

function scanChats(projectDir) {
  const baseRel = "chats";
  const base = resolveInside(projectDir, baseRel);
  if (!base || !fs.existsSync(base)) return [];
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }

  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((entry) => {
      const id = entry.name.slice(0, -3);
      const info = fileInfo(projectDir, `${baseRel}/${entry.name}`);
      const text = info.availability === "local" ? readHead(path.join(base, entry.name)) : "";
      return { key: `chat:${id}`, id, title: titleFrom(text, id), kind: "chat", origin: "chats", ...info };
    });
}

function scanExtractions(projectDir) {
  const baseRel = "context";
  const base = resolveInside(projectDir, baseRel);
  if (!base || !fs.existsSync(base)) return [];
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }

  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && /^extraido-.*\.md$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((entry) => {
      const id = entry.name.slice(0, -3);
      const info = fileInfo(projectDir, `${baseRel}/${entry.name}`);
      const text = info.availability === "local" ? readHead(path.join(base, entry.name)) : "";
      return { key: `extraction:${id}`, id, title: titleFrom(text, id), kind: "extraction", origin: "context", ...info };
    });
}

function scanContextFolder(projectDir, folder, kind) {
  const files = listFiles(projectDir, `context/extraidos/${folder}`, new Set([".md", ".txt", ".html", ".htm"]));
  return files.map((file) => {
    const id = path.basename(file, path.extname(file));
    const info = fileInfo(projectDir, file);
    const abs = resolveInside(projectDir, file);
    const text = abs && info.availability === "local" ? readHead(abs) : "";
    return { key: `${kind}:${file}`, id, title: titleFrom(text, id), kind, origin: `context/extraidos/${folder}`, ...info };
  });
}

function scanImported(projectDir) {
  const files = listFiles(projectDir, "artifacts", ALLOWED_EXTENSIONS);
  return files.map((file) => {
    const id = path.basename(file, path.extname(file));
    const info = fileInfo(projectDir, file);
    const abs = resolveInside(projectDir, file);
    const text = abs && info.availability === "local" ? readHead(abs) : "";
    return { key: `imported:${file}`, id, title: titleFrom(text, id), kind: "imported", origin: "artifacts", ...info };
  });
}

/**
 * Varre as fontes de artefatos do projeto.
 * @param {string} projectDir
 */
function scanProjectArtifacts(projectDir) {
  const warnings = [];
  const items = [
    ...scanDesign(projectDir, warnings),
    ...scanAteliers(projectDir, warnings),
    ...scanChats(projectDir),
    ...scanExtractions(projectDir),
    ...scanContextFolder(projectDir, "documentos", "document"),
    ...scanContextFolder(projectDir, "respostas", "response"),
    ...scanImported(projectDir),
  ];
  return { items, warnings };
}

module.exports = { scanProjectArtifacts, KINDS };

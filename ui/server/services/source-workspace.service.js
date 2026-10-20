// @ts-check
// Exploração e edição segura dos arquivos-fonte do app configurado no projeto.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { isInside } = require("./component-resolver.service");

const IGNORED_DIRS = new Set([
  ".git", ".angular", ".idea", ".vscode", "coverage", "dist", "build",
  "node_modules", "target", ".next", ".nuxt", ".output",
]);
const SOURCE_EXTENSIONS = new Set([
  ".css", ".go", ".graphql", ".gql", ".html", ".java", ".js", ".jsx",
  ".json", ".kt", ".less", ".md", ".mjs", ".properties", ".py", ".rs",
  ".sass", ".scss", ".sql", ".svelte", ".ts", ".tsx", ".vue", ".xml",
  ".yaml", ".yml",
]);
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_FILES = 3000;

function fingerprint(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isSensitiveFile(name) {
  const lower = name.toLowerCase();
  return lower === ".env" || lower.startsWith(".env.") ||
    /(^|[._-])(secret|secrets|credential|credentials)([._-]|$)/.test(lower) ||
    /\.(pem|key|p12|pfx|jks|keystore)$/.test(lower);
}

function resolveWorkspace(repo, cwd = "") {
  const repoRoot = path.resolve(repo || "");
  if (!repo || !fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    throw new Error("Diretório do repositório não encontrado.");
  }
  const workspaceRoot = path.resolve(repoRoot, cwd || ".");
  if (!isInside(repoRoot, workspaceRoot)) {
    throw new Error("Diretório da aplicação aponta para fora do repositório.");
  }
  if (!fs.existsSync(workspaceRoot) || !fs.statSync(workspaceRoot).isDirectory()) {
    throw new Error("Diretório da aplicação não encontrado.");
  }
  return workspaceRoot;
}

function isEditable(name) {
  return !isSensitiveFile(name) && SOURCE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function listSourceFiles(root) {
  const files = [];
  function visit(dir) {
    if (files.length >= MAX_FILES) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        visit(full);
      } else if (entry.isFile() && isEditable(entry.name)) {
        const stat = fs.statSync(full);
        if (stat.size <= MAX_FILE_SIZE) {
          files.push({
            path: path.relative(root, full).replace(/\\/g, "/"),
            name: entry.name,
            size: stat.size,
          });
        }
      }
    }
  }
  visit(root);
  return files;
}

function resolveSourceFile(root, relativePath) {
  if (!relativePath || typeof relativePath !== "string" || relativePath.includes("\0")) {
    throw new Error("Caminho de arquivo inválido.");
  }
  if (path.isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) {
    throw new Error("Acesso negado: caminhos absolutos não são permitidos.");
  }
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.includes("..") || segments.some((part) => IGNORED_DIRS.has(part))) {
    throw new Error("Acesso negado: caminho fora da área de código.");
  }
  const target = path.resolve(root, normalized);
  if (!isInside(root, target) || !isEditable(path.basename(target))) {
    throw new Error("Acesso negado: arquivo não editável.");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error("Arquivo não encontrado.");
  }
  const realRoot = fs.realpathSync(root);
  const realTarget = fs.realpathSync(target);
  if (!isInside(realRoot, realTarget)) {
    throw new Error("Acesso negado: link aponta para fora da aplicação.");
  }
  const size = fs.statSync(realTarget).size;
  if (size > MAX_FILE_SIZE) throw new Error("Arquivo excede o limite de 1 MB.");
  return { target: realTarget, normalized, size };
}

function readSourceFile(root, relativePath) {
  const file = resolveSourceFile(root, relativePath);
  const content = fs.readFileSync(file.target, "utf8");
  return { path: file.normalized, size: file.size, content, fingerprint: fingerprint(content) };
}

function saveSourceFile(root, relativePath, content, expectedFingerprint) {
  if (typeof content !== "string" || Buffer.byteLength(content) > MAX_FILE_SIZE) {
    throw new Error("Conteúdo inválido ou maior que 1 MB.");
  }
  const current = readSourceFile(root, relativePath);
  if (!expectedFingerprint || current.fingerprint !== expectedFingerprint) {
    const error = /** @type {Error & {code: string}} */ (
      new Error("O arquivo mudou desde que foi aberto. Recarregue antes de salvar.")
    );
    error.code = "CONFLICT_409";
    throw error;
  }
  const file = resolveSourceFile(root, relativePath);
  fs.writeFileSync(file.target, content, "utf8");
  return readSourceFile(root, relativePath);
}

module.exports = {
  MAX_FILE_SIZE,
  isSensitiveFile,
  resolveWorkspace,
  listSourceFiles,
  readSourceFile,
  saveSourceFile,
};

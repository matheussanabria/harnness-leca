// @ts-check
// Gerencia a área de rascunho temporária (scratchpad) de um protótipo no Ateliê.
// Isolamento completo de rascunhos, planos e notas antes da consolidação no protótipo.
const fs = require("fs");
const path = require("path");

const VALID_FILENAME_RE = /^[a-zA-Z0-9_\-][a-zA-Z0-9_.\-]{0,127}$/;

/**
 * Sanitiza e valida o nome do arquivo para impedir path traversal.
 * @param {string} filename
 * @returns {string}
 */
function sanitizeScratchFilename(filename) {
  if (typeof filename !== "string") throw new Error("Nome de arquivo inválido.");
  const clean = filename.trim();
  if (!VALID_FILENAME_RE.test(clean) || clean.includes("..") || clean.includes("/") || clean.includes("\\")) {
    throw new Error(`Nome de arquivo scratch inválido ou contém caracteres proibidos: "${filename}"`);
  }
  return clean;
}

/**
 * Obtém ou cria o diretório de rascunho (scratch) de um protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 * @returns {string}
 */
function getScratchDir(projectDir, protoId, deps = { fs, path }) {
  if (!projectDir || !protoId) throw new Error("projectDir e protoId são obrigatórios.");
  const protoDir = deps.path.join(projectDir, "design", "prototypes", protoId);
  if (!deps.fs.existsSync(protoDir)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }
  const scratchDir = deps.path.join(protoDir, "scratch");
  if (!deps.fs.existsSync(scratchDir)) {
    deps.fs.mkdirSync(scratchDir, { recursive: true });
  }
  return scratchDir;
}

/**
 * Escreve um arquivo no scratchpad do protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} filename
 * @param {string|object} content
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 */
function writeScratchFile(projectDir, protoId, filename, content, deps = { fs, path }) {
  const safeName = sanitizeScratchFilename(filename);
  const scratchDir = getScratchDir(projectDir, protoId, deps);
  const targetPath = deps.path.join(scratchDir, safeName);
  const data = typeof content === "object" && content !== null ? JSON.stringify(content, null, 2) : String(content ?? "");
  deps.fs.writeFileSync(targetPath, data, "utf8");
  return { ok: true, filename: safeName, size: Buffer.byteLength(data, "utf8"), path: targetPath };
}

/**
 * Lê um arquivo do scratchpad do protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} filename
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 * @returns {{ filename: string, content: string, mtime: string }}
 */
function readScratchFile(projectDir, protoId, filename, deps = { fs, path }) {
  const safeName = sanitizeScratchFilename(filename);
  const scratchDir = getScratchDir(projectDir, protoId, deps);
  const targetPath = deps.path.join(scratchDir, safeName);
  if (!deps.fs.existsSync(targetPath)) {
    throw new Error(`Arquivo '${safeName}' não encontrado no scratchpad.`);
  }
  const content = deps.fs.readFileSync(targetPath, "utf8");
  const stat = deps.fs.statSync(targetPath);
  return { filename: safeName, content, mtime: stat.mtime.toISOString(), size: stat.size };
}

/**
 * Lista todos os arquivos existentes no scratchpad do protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 * @returns {Array<{ filename: string, size: number, mtime: string }>}
 */
function listScratchFiles(projectDir, protoId, deps = { fs, path }) {
  const scratchDir = getScratchDir(projectDir, protoId, deps);
  const entries = deps.fs.readdirSync(scratchDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => {
      const p = deps.path.join(scratchDir, e.name);
      const st = deps.fs.statSync(p);
      return { filename: e.name, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Limpa todos os arquivos do diretório scratch de um protótipo.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {{ fs?: typeof fs, path?: typeof path }} [deps]
 */
function cleanScratchDir(projectDir, protoId, deps = { fs, path }) {
  const scratchDir = getScratchDir(projectDir, protoId, deps);
  const entries = deps.fs.readdirSync(scratchDir);
  for (const name of entries) {
    deps.fs.unlinkSync(deps.path.join(scratchDir, name));
  }
  return { ok: true, removed: entries.length };
}

module.exports = {
  sanitizeScratchFilename,
  getScratchDir,
  writeScratchFile,
  readScratchFile,
  listScratchFiles,
  cleanScratchDir,
};

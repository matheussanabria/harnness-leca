// @ts-check
// Utilitários de caminho, busca de arquivos .ts e normalização de nomes.
const fs = require("fs");
const path = require("path");
const { IGNORED_DIRS } = require("./component-resolver-store");

/**
 * Escapa caracteres especiais para uso seguro em expressões regulares.
 * @param {string} str
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Garante que o caminho alvo está estritamente contido no diretório raiz.
 * @param {string} rootPath
 * @param {string} targetPath
 * @returns {boolean}
 */
function isInside(rootPath, targetPath) {
  const rel = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Procura recursivamente por arquivos .ts em um diretório, ignorando pastas irrelevantes.
 * @param {string} dir
 * @param {object} [deps]
 * @returns {string[]}
 */
function findTsFiles(dir, deps = { fs, path }) {
  const results = [];
  try {
    const entries = deps.fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = deps.path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          results.push(...findTsFiles(fullPath, deps));
        }
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

/**
 * Normaliza o nome do componente Angular removendo prefixos de compilação do esbuild/Angular (_ e ɵ).
 * @param {string} name
 * @returns {string}
 */
function normalizeComponentName(name) {
  if (!name || typeof name !== "string") return "";
  return name.replace(/^[_ɵ]+/, "").trim();
}

module.exports = { escapeRegExp, isInside, findTsFiles, normalizeComponentName };

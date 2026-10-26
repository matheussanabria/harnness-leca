// @ts-check
// Camada de I/O em disco para itens de memória (EP-13.03).
// Lê e grava arquivos de memória tolerando BOM e validando o contrato.
const fs = require("fs");
const path = require("path");
const { parseItem } = require("./item");

/** @typedef {import("./item").Item} Item */
/** @typedef {import("./item").ErroContrato} ErroContrato */
/** @typedef {{ path: string, relPath: string, item?: Item, errors?: ErroContrato[] }} LeituraItem */

/**
 * Resolve o diretório raiz de memória para o escopo dado.
 * @param {string} rootDir Diretório raiz do projeto/workspace
 * @param {string} [slug] Slug do projeto ou vazio para global
 * @returns {string}
 */
function resolveMemoryDir(rootDir, slug) {
  if (!slug || slug === "global") {
    return path.join(rootDir, "global", "memory");
  }
  return path.join(rootDir, "projects", slug, "memory");
}

/**
 * Varre recursivamente um diretório procurando arquivos .md.
 * @param {string} dir
 * @returns {string[]}
 */
function walkMdFiles(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  /** @type {string[]} */
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Lê todos os itens de memória de um escopo.
 * Devolve itens válidos e relata itens com erros de contrato sem interromper.
 * @param {string} memoryDir Diretório base da memória (ex: projects/<slug>/memory)
 * @returns {{ valid: Array<{ file: string, relPath: string, item: Item }>, invalid: Array<{ file: string, relPath: string, errors: ErroContrato[] }> }}
 */
function listItems(memoryDir) {
  if (!fs.existsSync(memoryDir)) {
    return { valid: [], invalid: [] };
  }

  const files = walkMdFiles(memoryDir);
  /** @type {Array<{ file: string, relPath: string, item: Item }>} */
  const valid = [];
  /** @type {Array<{ file: string, relPath: string, errors: ErroContrato[] }>} */
  const invalid = [];

  for (const file of files) {
    const relPath = path.relative(memoryDir, file).replace(/\\/g, "/");
    // Ignora índices antigos ou arquivos de índice que fiquem dentro da pasta
    if (path.basename(file).startsWith("index") || path.basename(file).startsWith("memory.")) continue;

    const raw = fs.readFileSync(file, "utf8");
    const parsed = parseItem(raw);
    if (Array.isArray(parsed)) {
      invalid.push({ file, relPath, errors: parsed });
    } else {
      valid.push({ file, relPath, item: parsed });
    }
  }

  return { valid, invalid };
}

module.exports = {
  resolveMemoryDir,
  listItems,
};

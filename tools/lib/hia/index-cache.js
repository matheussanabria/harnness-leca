// @ts-check
const crypto = require("crypto");
const fs = require("fs");

/** @type {Map<string, { hash: string, mtimeMs: number, size: number, content: string }>} */
const memoryCache = new Map();

/**
 * Calcula hash SHA-256 de uma string
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return crypto.createHash("sha256").update(text || "", "utf8").digest("hex");
}

/**
 * Lê arquivo com cache baseado em mtimeMs e hash SHA-256
 * @param {string} filePath
 * @returns {{ content: string, hash: string, changed: boolean }}
 */
function readWithCache(filePath) {
  if (!fs.existsSync(filePath)) {
    return { content: "", hash: "", changed: false };
  }

  const stat = fs.statSync(filePath);
  const cached = memoryCache.get(filePath);

  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return { content: cached.content, hash: cached.hash, changed: false };
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  const hash = sha256(content);
  const changed = !cached || cached.hash !== hash;

  memoryCache.set(filePath, {
    hash,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    content,
  });

  return { content, hash, changed };
}

/**
 * Limpa o cache em memória
 */
function clearCache() {
  memoryCache.clear();
}

module.exports = { sha256, readWithCache, clearCache };

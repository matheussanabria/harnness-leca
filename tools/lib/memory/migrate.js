// @ts-check
// Migrador de bullets antigos de memory.md para itens atômicos (EP-13.04).
// Processa linhas "- [data] fato", classifica por regras simples e deduplica por similaridade.
const fs = require("fs");
const path = require("path");
const { slugify, serializeItem } = require("./item");
const { isSimilar } = require("./dedupe");

/** @typedef {import("./item").TipoItem} TipoItem */
/** @typedef {import("./item").MetaItem} MetaItem */

const BULLET_RE = /^-\s*(?:\[(\d{4}-\d{2}-\d{2})\]\s*)?(.+)$/;

/**
 * Classifica o tipo sugerido para um fato baseado em heurísticas textuais (RF2).
 * @param {string} text
 * @returns {TipoItem}
 */
function inferType(text) {
  const lower = text.toLowerCase();
  // Feedback do usuário / preferências / regras negativas
  if (
    lower.includes("prefere") ||
    lower.includes("regra do usuario") ||
    lower.includes("usuario prefere") ||
    /\bnão\s+[a-z]+/.test(lower) ||
    lower.includes("nunca") ||
    lower.includes("sempre") ||
    lower.includes("proibido")
  ) {
    return "feedback";
  }

  // Referência técnica, paths, links, repositórios, configurações externas
  if (
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("caminho") ||
    lower.includes("repo") ||
    lower.includes("porta ") ||
    lower.includes(".md") ||
    lower.includes(".json") ||
    lower.includes("git/")
  ) {
    return "reference";
  }

  // Projetos, decisões arquiteturais, iniciativas
  if (
    lower.includes("iniciativa") ||
    lower.includes("decisao") ||
    lower.includes("arquitetura") ||
    lower.includes("marco ") ||
    lower.includes("ep-")
  ) {
    return "project";
  }

  // Fallback padrão para preferências de usuário ou projeto
  return "project";
}

/**
 * Extrai bullets de um texto bruto de memory.md.
 * @param {string} rawContent
 * @returns {Array<{ date: string, text: string }>}
 */
function parseBullets(rawContent) {
  const lines = rawContent.replace(/^\uFEFF/, "").split(/\r?\n/);
  const bullets = [];
  const defaultDate = new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const match = trimmed.match(BULLET_RE);
    if (match) {
      const date = match[1] || defaultDate;
      const text = match[2].trim();
      bullets.push({ date, text });
    }
  }
  return bullets;
}

/**
 * Agrupa bullets idênticos ou com similaridade >= 0.8 (RF4).
 * Combina a data mais antiga em created e a mais recente em updated.
 * @param {Array<{ date: string, text: string }>} bullets
 * @returns {Array<{ name: string, description: string, type: TipoItem, created: string, updated: string, duplicatesCount: number }>}
 */
function deduplicateBullets(bullets) {
  /** @type {Array<{ name: string, description: string, type: TipoItem, created: string, updated: string, duplicatesCount: number }>} */
  const results = [];

  for (const b of bullets) {
    const existing = results.find((r) => isSimilar(r.description, b.text, 0.8));
    if (existing) {
      existing.duplicatesCount++;
      if (b.date < existing.created) existing.created = b.date;
      if (b.date > existing.updated) existing.updated = b.date;
    } else {
      const type = inferType(b.text);
      const name = slugify(b.text.slice(0, 50));
      results.push({
        name: name || "memoria-fato",
        description: b.text.slice(0, 140),
        type,
        created: b.date,
        updated: b.date,
        duplicatesCount: 0,
      });
    }
  }

  return results;
}

module.exports = {
  inferType,
  parseBullets,
  deduplicateBullets,
};

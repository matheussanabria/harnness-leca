// @ts-check
const fs = require("fs");
const path = require("path");
const { EPIC_OWNERS } = require("./config");

const ITEM = /^- \[([ xX])\]\s+(?:\[)?(\d{2}\.\d{2})(?:\]\(([^)]+)\))?\s+(.+)$/;

function cleanTitle(value) {
  return value.replace(/\s+\(HAR-\d+\)\s*$/, "").trim();
}

function declaredDependencies(indexFile, document) {
  if (!document) return [];
  const evolutionDir = path.dirname(indexFile);
  const file = path.resolve(evolutionDir, document);
  if (!file.startsWith(`${evolutionDir}${path.sep}`) || !fs.existsSync(file)) return [];
  const head = fs.readFileSync(file, "utf8").split(/^---\s*$/m)[1] || "";
  const line = head.split(/\r?\n/).find((item) => /^dependencias\s*:/.test(item.trim()));
  return line ? [...line.matchAll(/EP-\d{2}\.\d{2}/g)].map((match) => match[0]) : [];
}

function readBacklog(root) {
  const file = path.join(root, "docs", "harness-evolution", "00-index.md");
  if (!fs.existsSync(file)) throw new Error(`Indice de evolucao nao encontrado: ${file}`);
  const stories = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(ITEM);
    if (!match) continue;
    const id = `EP-${match[2]}`;
    const epic = `EP-${match[2].slice(0, 2)}`;
    if (stories[id]) continue;
    stories[id] = {
      id,
      epic,
      title: cleanTitle(match[4]),
      status: match[1].trim() ? "done" : "planned",
      owner: EPIC_OWNERS[epic] || null,
      document: match[3] || null,
      dependencies: declaredDependencies(file, match[3]),
      fileScopes: [],
      lease: null,
      evidence: [],
      updatedAt: null,
    };
  }
  for (const item of Object.values(stories)) {
    if (item.dependencies.length) continue;
    const number = Number(item.id.slice(-2));
    if (number <= 1) continue;
    const previous = `${item.epic}.${String(number - 1).padStart(2, "0")}`;
    if (stories[previous]) item.dependencies = [previous];
  }
  if (!Object.keys(stories).length) throw new Error("O indice nao contem historias reconheciveis.");
  return stories;
}

module.exports = { readBacklog };

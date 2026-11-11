// @ts-check
// Historia -> telas e campos do Mapa em Camadas, lido de doc/sistema/features/_historias-funcionalidades.json.
// Cada linha da tabela e uma funcionalidade (tela, campo) ligada a uma historia principal e a historias relacionadas.
const fs = require("fs");
const path = require("path");

const REL_PATH = path.join("doc", "sistema", "features", "_historias-funcionalidades.json");
const KEY_RE = /^[A-Z]+-(\d+|XXX)$/;
const MAX_BYTES = 2 * 1024 * 1024;

/** @param {any} value */
const text = (value) => (typeof value === "string" ? value : "");

/** @param {string} repoRoot @returns {any[]} */
function readRows(repoRoot) {
  try {
    const file = path.join(repoRoot, REL_PATH);
    if (fs.statSync(file).size > MAX_BYTES) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data.funcionalidades) ? data.funcionalidades : [];
  } catch {
    return [];
  }
}

/** Resolve tela e campo no mapa. Sem tela (ou tela fora do mapa) o vinculo fica sem screenId. */
function resolveTarget(row, screens) {
  const screen = screens.find((s) => s.id === row.tela);
  if (!screen) return { screenId: null, screenTitle: "", fieldId: null, fieldLabel: "" };
  const field = (screen.fields || []).find((f) => f.id === row.campo);
  return {
    screenId: screen.id,
    screenTitle: text(screen.short || screen.title),
    fieldId: field ? field.id : null,
    fieldLabel: field ? text(field.label) : "",
  };
}

/**
 * @param {string} repoRoot
 * @param {any[]} screens telas finais do Mapa em Camadas
 * @returns {Record<string, { dona: any[], relacionada: any[] }>}
 */
function readFieldLinks(repoRoot, screens) {
  /** @type {Record<string, { dona: any[], relacionada: any[] }>} */
  const byStory = {};
  const put = (key, bucket, item) => {
    if (!KEY_RE.test(key)) return;
    (byStory[key] ||= { dona: [], relacionada: [] })[bucket].push(item);
  };
  for (const row of readRows(repoRoot)) {
    if (!row || typeof row !== "object") continue;
    const item = {
      k: text(row.k),
      grupo: text(row.grupo),
      rotulo: text(row.rotulo),
      conferido: Boolean(row.conferido),
      ...resolveTarget(row, screens),
    };
    put(text(row.principal), "dona", item);
    for (const key of Array.isArray(row.relacionadas) ? row.relacionadas : []) put(text(key), "relacionada", item);
  }
  return byStory;
}

module.exports = { readFieldLinks, REL_PATH };

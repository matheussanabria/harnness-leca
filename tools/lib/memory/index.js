// @ts-check
// Gerador puro do índice de memória (EP-13.03).
// Agrupa itens por tipo na ordem fixa, ordena por name e aplica teto de 150 linhas.
const { slugify } = require("./item");

/** @typedef {import("./item").Item} Item */
/** @typedef {import("./item").TipoItem} TipoItem */

const MAX_INDEX_LINES = 150;
const TIPO_TITULOS = /** @type {const} */ ({
  user: "user",
  feedback: "feedback",
  project: "project",
  reference: "reference",
});
const ORDEM_TIPOS = /** @type {readonly TipoItem[]} */ (["user", "feedback", "project", "reference"]);

/**
 * Converte data de hoje para YYYY-MM-DD em UTC.
 * @param {Date} [d]
 * @returns {string}
 */
function getIsoDate(d = new Date()) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Renderiza o índice de memória a partir dos itens.
 * Função pura e determinística.
 * @param {Array<{ relPath: string, item: Item }>} entries Itens válidos com caminho relativo
 * @param {{ today?: string, scopeTitle?: string, maxLines?: number }} [options]
 * @returns {{ content: string, linesCount: number, overLimit: boolean, archiveCandidates: Array<{ name: string, created: string, relPath: string }> }}
 */
function render(entries, options = {}) {
  const today = options.today || getIsoDate();
  const title = options.scopeTitle || "Memória do projeto";
  const limit = options.maxLines || MAX_INDEX_LINES;

  /** @type {Record<TipoItem, Array<{ relPath: string, item: Item }>>} */
  const groups = {
    user: [],
    feedback: [],
    project: [],
    reference: [],
  };

  for (const entry of entries) {
    const t = entry.item.meta.type;
    if (groups[t]) {
      groups[t].push(entry);
    }
  }

  // Ordena cada grupo alfabeticamente por name
  for (const t of ORDEM_TIPOS) {
    groups[t].sort((a, b) => a.item.meta.name.localeCompare(b.item.meta.name));
  }

  const lines = [
    `# ${title}`,
    `<!-- Gerado por tools/memory.js index em ${today}. Não editar: use tools/memory.js save. -->`,
  ];

  for (const t of ORDEM_TIPOS) {
    const items = groups[t];
    if (items.length === 0) continue;

    lines.push("");
    lines.push(`## ${TIPO_TITULOS[t]}`);
    for (const entry of items) {
      const meta = entry.item.meta;
      const caminho = `memory/${entry.relPath}`.replace(/\\/g, "/");
      // Título do link: se houver uma forma legível, usamos name ou fallback
      const linkText = meta.name;
      lines.push(`- [${linkText}](${caminho}) — ${meta.description}`);
    }
  }

  lines.push(""); // Final newline
  const content = lines.join("\n");
  const linesCount = lines.length;
  const overLimit = linesCount > limit;

  /** @type {Array<{ name: string, created: string, relPath: string }>} */
  let archiveCandidates = [];
  if (overLimit) {
    // Candidatos a arquivar: itens de tipo 'project' mais antigos (ordem crescente de created)
    archiveCandidates = groups.project
      .slice()
      .sort((a, b) => a.item.meta.created.localeCompare(b.item.meta.created))
      .map((entry) => ({
        name: entry.item.meta.name,
        created: entry.item.meta.created,
        relPath: entry.relPath,
      }));
  }

  return {
    content,
    linesCount,
    overLimit,
    archiveCandidates,
  };
}

module.exports = {
  MAX_INDEX_LINES,
  ORDEM_TIPOS,
  render,
};

// @ts-check
const fs = require("fs");
const path = require("path");
const { scanProjectArtifacts, KINDS } = require("./artifact-inventory-scan.service");
const { applyArtifactMetadata } = require("./artifact-metadata.service");

const DEFAULT_LIMIT = 500;

function buildSummary(items) {
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  let missing = 0;
  let invalid = 0;
  let external = 0;
  for (const item of items) {
    if (byKind[item.kind] !== undefined) byKind[item.kind] += 1;
    if (item.availability === "missing") missing += 1;
    else if (item.availability === "invalid") invalid += 1;
    else if (item.availability === "external") external += 1;
  }
  return { total: items.length, byKind, missing, invalid, external };
}

/**
 * Inventaria artefatos visíveis do projeto sem ler conteúdo nem seguir symlinks.
 * @param {string} projectDir
 * @param {{slug?: string, limit?: number, includeLocal?: boolean}} [options]
 */
function inventoryProjectArtifacts(projectDir, options = {}) {
  const root = path.resolve(projectDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("Projeto não encontrado.");
  const { items: collected, warnings } = scanProjectArtifacts(root);
  const merged = applyArtifactMetadata(root, collected, { includeLocal: options.includeLocal === true });
  warnings.push(...merged.warnings);
  const seen = new Set();
  const unique = merged.items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
  const order = new Map(KINDS.map((kind, index) => [kind, index]));
  unique.sort((a, b) => (order.get(a.kind) - order.get(b.kind)) || a.title.localeCompare(b.title, "pt-BR") || a.key.localeCompare(b.key));

  const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
  const items = unique.slice(0, limit);
  return {
    ok: true,
    project: options.slug || path.basename(root),
    generatedAt: new Date().toISOString(),
    summary: buildSummary(unique),
    truncated: unique.length > items.length,
    warnings,
    items,
  };
}

module.exports = { inventoryProjectArtifacts, KINDS };

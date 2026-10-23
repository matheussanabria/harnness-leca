// @ts-check
const fs = require("fs");
const path = require("path");
const { loadRegistry } = require("./design-registry.service");

/**
 * Componentes do registro do Design System do projeto (design/ds/registry.json, publicado por tools/ds-sync.js),
 * no formato do índice do quadro. A chave é o slug sem o namespace ("text-field" para "dis.text-field"),
 * a mesma que o índice usa para as pastas do DS, para que os dois se encontrem.
 * @param {string} projectDir
 * @param {{ fs: typeof fs, path: typeof path }} [deps]
 */
function registryComponentsForIndex(projectDir, deps = { fs, path }) {
  const registry = loadRegistry(projectDir, deps);
  const project = deps.path.basename(projectDir);
  const out = [];
  for (const comp of Object.values(registry.components)) {
    const registryId = String(comp.id || "");
    if (!registryId) continue;
    const dot = registryId.indexOf(".");
    const slug = (dot >= 0 ? registryId.slice(dot + 1) : registryId).toLowerCase();
    out.push({
      id: slug,
      registryId,
      name: comp.name || slug,
      category: comp.category || "",
      selector: `app-${slug}`,
      dsFolder: `projects/${project}/design/ds/components/${slug}`,
      feature: "design-system",
      inDesignSystem: true,
      sync: { version: comp.version || "", updatedAt: comp.updatedAt || "", sourceHash: comp.sourceHash || "" },
      files: {},
    });
  }
  return out;
}

module.exports = { registryComponentsForIndex };

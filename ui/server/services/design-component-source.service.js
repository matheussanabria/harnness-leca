// @ts-check
const fs = require("fs");
const path = require("path");
const { loadRegistry } = require("./design-registry.service");
const { resolveComponentDir } = require("./prototype-traceability.service");

/** Acima disso o arquivo aparece só como "grande demais", sem o conteúdo. */
const MAX_FILE_BYTES = 200 * 1024;

/** Caminho relativo seguro dentro da pasta do componente. */
const SAFE_REL = /^[\w.\-/]+$/;

/**
 * Código-fonte de um componente do DS, por framework (lido da pasta do componente no DS vivo).
 * @param {string} projectDir
 * @param {string} componentId
 * @param {{ fs: typeof fs, path: typeof path }} [deps]
 */
function readComponentSource(projectDir, componentId, deps = { fs, path }) {
  const meta = loadRegistry(projectDir, deps).components[componentId] || null;
  const dir = resolveComponentDir(projectDir, componentId, deps);
  if (!dir) throw new Error(`Pasta do componente '${componentId}' não encontrada no Design System.`);

  let manifest = null;
  try { manifest = JSON.parse(deps.fs.readFileSync(deps.path.join(dir, "manifest.json"), "utf8")); } catch {}
  const implementations = manifest?.implementations || meta?.implementations || {};

  const files = [];
  for (const [framework, impl] of Object.entries(implementations)) {
    if (!impl || !Array.isArray(impl.files)) continue;
    for (const file of impl.files) {
      if (!SAFE_REL.test(file) || file.includes("..")) continue;
      const full = deps.path.join(dir, file);
      if (!deps.fs.existsSync(full)) continue;
      const size = deps.fs.statSync(full).size;
      const tooBig = size > MAX_FILE_BYTES;
      files.push({
        framework,
        path: file,
        entry: impl.entryFile === file,
        bytes: size,
        content: tooBig ? null : deps.fs.readFileSync(full, "utf8"),
      });
    }
  }

  return {
    componentId,
    name: meta?.name || manifest?.name || componentId,
    folder: deps.path.basename(dir),
    files,
  };
}

module.exports = { readComponentSource };

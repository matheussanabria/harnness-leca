// @ts-check
const fs = require("fs");
const path = require("path");
const { isInside } = require("./design-layers.service");

/**
 * Resolve um artefato estatico mantendo arquivo principal e assets confinados
 * ao diretorio design/ do projeto atual.
 * @param {string} projectDir
 * @param {{file?: string}} prototype
 * @param {string} [rawSubpath]
 * @param {{fs: typeof fs, path: typeof path}} [deps]
 */
function resolvePrototypeArtifact(projectDir, prototype, rawSubpath = "", deps = { fs, path }) {
  const designDir = deps.path.resolve(projectDir, "design");
  if (!prototype?.file) return { ok: false, status: 404, error: "Artefato sem arquivo local." };

  const mainFile = deps.path.resolve(projectDir, prototype.file);
  if (!isInside(designDir, mainFile) || !deps.fs.existsSync(mainFile)) {
    return { ok: false, status: 404, error: "Arquivo HTML nao encontrado no projeto." };
  }

  const prototypeDir = deps.path.dirname(mainFile);
  let targetFile = mainFile;
  if (rawSubpath && rawSubpath.trim() && rawSubpath !== deps.path.basename(mainFile)) {
    const cleanSubpath = decodeURIComponent(rawSubpath).replace(/^\/+/, "");
    if (cleanSubpath.includes("\0") || cleanSubpath.includes("..")) {
      return { ok: false, status: 400, error: "Asset invalido." };
    }
    const assetFile = deps.path.resolve(prototypeDir, cleanSubpath);
    if (!isInside(prototypeDir, assetFile) || !deps.fs.existsSync(assetFile)) {
      return { ok: false, status: 404, error: "Asset nao encontrado." };
    }
    targetFile = assetFile;
  }

  const stat = deps.fs.statSync(targetFile);
  if (!stat.isFile()) return { ok: false, status: 400, error: "Asset invalido." };
  return { ok: true, file: targetFile, size: stat.size };
}

module.exports = { resolvePrototypeArtifact };

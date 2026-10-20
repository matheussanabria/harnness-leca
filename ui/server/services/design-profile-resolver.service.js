// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Mescla profundamente dois objetos simples.
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
function deepMerge(target, source) {
  const result = { ...(target || {}) };
  if (!source || typeof source !== "object") return result;

  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== undefined) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        result[key] = deepMerge(result[key] || {}, val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Lê e parseia um arquivo JSON com proteção contra BOM e erro de sintaxe.
 * @param {string} filePath
 * @param {object} deps
 * @returns {any}
 */
function readJsonSafe(filePath, deps = { fs }) {
  try {
    if (!deps.fs.existsSync(filePath)) return null;
    const raw = deps.fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve o perfil de design consolidado de um projeto em 3 camadas:
 * 1. defaults.json
 * 2. design-systems/<ref>.json (se especificado via 'ref' ou 'extends')
 * 3. profile.json do projeto (sobrescritas locais)
 *
 * @param {string} projectDir - Diretório do projeto (ex: projects/<slug>)
 * @param {string} [globalDir] - Diretório global (ex: global)
 * @param {object} [deps] - Dependências injetadas
 */
function resolveProjectDesignProfile(projectDir, globalDir = "", deps = { fs, path }) {
  const resolvedGlobalDir = globalDir || deps.path.resolve(projectDir, "..", "..", "global");
  const defaultsPath = deps.path.join(resolvedGlobalDir, "design", "defaults.json");

  // 1. Camada Base: defaults.json
  const defaults = readJsonSafe(defaultsPath, deps) || {
    schema: 1,
    designSystem: { provider: "none", prefix: "ds-", tokensCss: "design/tokens.css", componentsDir: "" },
    framework: { adapter: "static-html" },
    docs: { layers: { adapter: "markdown-folders", featuresGlob: "doc/features/*" } },
    stages: { enabled: ["prototype", "extracted", "design_system", "boilerplate", "implemented", "documented"] },
    agents: { source: "dai", map: {} },
    prototypes: { viewports: [{ id: "desktop", label: "Desktop", width: 1280 }] },
  };

  // 2. Camada do Projeto: profile.json
  const projectProfilePath = deps.path.join(projectDir, "design", "profile.json");
  const projectProfile = readJsonSafe(projectProfilePath, deps) || {};

  // 3. Camada do Design System Compartilhado (se houver ref)
  const dsRef = projectProfile.designSystem?.ref || defaults.designSystem?.ref || null;
  let sharedDs = {};
  if (dsRef && typeof dsRef === "string" && /^[a-z0-9_-]{1,60}$/i.test(dsRef)) {
    const dsPath = deps.path.join(resolvedGlobalDir, "design", "design-systems", `${dsRef}.json`);
    const loadedDs = readJsonSafe(dsPath, deps);
    if (loadedDs) {
      sharedDs = loadedDs;
    }
  }

  // Mesclagem hierárquica: defaults -> sharedDs -> projectProfile
  let merged = deepMerge(defaults, sharedDs);
  merged = deepMerge(merged, projectProfile);

  // Aplica overrides específicos de designSystem se declarados
  if (projectProfile.designSystem?.overrides) {
    merged.designSystem = deepMerge(merged.designSystem, projectProfile.designSystem.overrides);
  }

  // Garante schema: 1 e integridade dos nós essenciais
  merged.schema = 1;
  merged.isGeneric = !projectProfile.designSystem && !sharedDs.designSystem;
  merged.hasProfileFile = Boolean(readJsonSafe(projectProfilePath, deps));

  return merged;
}

module.exports = {
  deepMerge,
  readJsonSafe,
  resolveProjectDesignProfile,
};

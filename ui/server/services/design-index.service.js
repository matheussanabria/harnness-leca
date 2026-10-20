// @ts-check
const fs = require("fs");
const path = require("path");
const { enrichComponentStage } = require("./design-stage.service");
const { scanRepositoryLayers, isInside } = require("./design-layers.service");
const { listComponents } = require("./component-resolver.service");

/**
 * Valida se uma URL externa é estritamente segura (HTTPS).
 * @param {string} url
 */
function isSafeHttpsUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Descobre componentes e boilerplates existentes na pasta de componentes do repositório.
 * @param {string} repoRoot
 * @param {object} [deps]
 * @param {string} [componentsDirRel]
 */
function scanDesignSystemFolders(repoRoot, deps = { fs, path }, componentsDirRel = "") {
  if (!componentsDirRel) {
    return { dsComponents: new Set(), boilerplateComponents: new Set(), discovered: [] };
  }
  const dsDir = deps.path.resolve(repoRoot, componentsDirRel);
  const dsComponents = new Set();
  const boilerplateComponents = new Set();
  const discovered = [];

  if (!deps.fs.existsSync(dsDir)) {
    return { dsComponents, boilerplateComponents, discovered };
  }

  try {
    const entries = deps.fs.readdirSync(dsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      const folderPath = deps.path.join(dsDir, ent.name);
      const cleanName = ent.name.replace(/^\d+[-_]?/, "");
      const compId = cleanName.toLowerCase();
      dsComponents.add(compId);

      let hasTs = false;
      let hasHtml = false;
      let hasCss = false;
      let tsRelPath = "";

      const subEntries = deps.fs.readdirSync(folderPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isFile()) continue;
        if (sub.name.endsWith(".component.ts") || sub.name.endsWith(".ts")) {
          hasTs = true;
          tsRelPath = `${componentsDirRel}/${ent.name}/${sub.name}`;
        }
        if (sub.name.endsWith(".html")) hasHtml = true;
        if (sub.name.endsWith(".css")) hasCss = true;
      }

      if (hasTs && (hasHtml || hasCss)) {
        boilerplateComponents.add(compId);
      }

      discovered.push({
        id: compId,
        name: cleanName.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") + "Component",
        dsFolder: `${componentsDirRel}/${ent.name}`,
        tsFile: tsRelPath,
        hasBoilerplate: hasTs && (hasHtml || hasCss),
      });
    }
  } catch {}

  return { dsComponents, boilerplateComponents, discovered };
}

/**
 * Descobre componentes Angular implementados no app (src/app).
 * @param {string} repoRoot
 * @param {string} [appCwd]
 * @param {object} [deps]
 */
function scanImplementedComponents(repoRoot, appCwd = "", deps = { fs, path }) {
  const implementedComponents = new Set();
  try {
    const list = listComponents(repoRoot, { appCwd, deps });
    if (Array.isArray(list)) {
      for (const c of list) {
        if (c.className) implementedComponents.add(c.className.toLowerCase());
        if (c.selector) implementedComponents.add(c.selector.toLowerCase());
      }
    }
  } catch {}
  return implementedComponents;
}

/**
 * Carrega e valida design.json de projects/<slug>/design/ com sanitização de campos.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function loadDesignJson(projectDir, deps = { fs, path }) {
  const jsonFile = deps.path.join(projectDir, "design", "design.json");
  if (!deps.fs.existsSync(jsonFile)) return null;

  try {
    const raw = deps.fs.readFileSync(jsonFile, "utf8").replace(/^\uFEFF/, "");
    const data = JSON.parse(raw);
    if (data.schema !== 1) {
      throw new Error(`Esquema do design.json não suportado: ${data.schema} (esperado: 1).`);
    }

    // Sanitiza caminhos e URLs
    const sanitizedPrototypes = Array.isArray(data.prototypes) ? data.prototypes.map((p) => {
      const safeUrl = p.externalUrl && isSafeHttpsUrl(p.externalUrl) ? p.externalUrl : null;
      const normalizedFile = typeof p.file === "string" ? p.file.replace(/\\/g, "/").replace(/^\.\//, "") : "";
      const safeFile = normalizedFile &&
        !normalizedFile.includes("..") &&
        !normalizedFile.startsWith("/") &&
        !/^[a-z]:\//i.test(normalizedFile)
        ? normalizedFile
        : null;
      return { ...p, file: safeFile, externalUrl: safeUrl };
    }) : [];

    const sanitizedComponents = Array.isArray(data.components) ? data.components.map((c) => {
      const safeFolder = c.dsFolder && typeof c.dsFolder === "string" && !c.dsFolder.includes("..") ? c.dsFolder.replace(/\\/g, "/") : null;
      return { ...c, dsFolder: safeFolder };
    }) : [];

    return {
      schema: 1,
      project: data.project || "",
      prototypes: sanitizedPrototypes,
      components: sanitizedComponents,
      features: Array.isArray(data.features) ? data.features : [],
    };
  } catch (err) {
    throw new Error("Erro na validação do design.json: " + (err.message || String(err)));
  }
}

/**
 * Monta o índice consolidado de design do projeto combinando autodescoberta e design.json.
 * @param {string} projectDir
 * @param {string} repoRoot
 * @param {object} [options]
 */
function buildDesignIndex(projectDir, repoRoot, options = {}) {
  const deps = options.deps || { fs, path };
  const appCwd = options.appCwd || "";

  let designJson = null;
  let hasDesignJson = false;
  try {
    designJson = loadDesignJson(projectDir, deps);
    hasDesignJson = designJson !== null;
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }

  const profile = options.profile || null;
  let componentsDirRel = profile?.designSystem?.componentsDir || options.componentsDir || "";
  if (!componentsDirRel) {
    const candidate = deps.path.join("doc", "design-system").replace(/\\/g, "/");
    if (deps.fs.existsSync(deps.path.resolve(repoRoot, candidate))) {
      componentsDirRel = candidate;
    }
  }

  // 1. Descoberta no repositório
  const layersData = scanRepositoryLayers(repoRoot, deps, profile?.docs);
  const dsData = scanDesignSystemFolders(repoRoot, deps, componentsDirRel);
  const implementedComponents = scanImplementedComponents(repoRoot, appCwd, deps);

  const context = {
    prototypeComponents: layersData.prototypeComponents,
    extractedComponents: new Set([...dsData.dsComponents, ...layersData.documentedComponents]),
    dsComponents: dsData.dsComponents,
    boilerplateComponents: dsData.boilerplateComponents,
    implementedComponents,
    documentedComponents: layersData.documentedComponents,
  };

  // 2. Componentes: mescla os de design.json com os descobertos na pasta do Design System
  const compMap = new Map();

  // A. Adiciona autodescobertos do DS
  for (const disc of dsData.discovered) {
    compMap.set(disc.id, {
      id: disc.id,
      name: disc.name,
      selector: `app-${disc.id}`,
      dsFolder: disc.dsFolder,
      feature: "design-system",
      files: {
        ds: disc.tsFile,
      },
    });
  }

  // B. Mescla ou sobrescreve com design.json
  if (designJson && Array.isArray(designJson.components)) {
    for (const c of designJson.components) {
      const existing = compMap.get(c.id) || {};
      compMap.set(c.id, { ...existing, ...c });
    }
  }

  // B2. Mescla componentes extraídos de protótipos do Ateliê
  try {
    const protoBaseDir = deps.path.join(projectDir, "design", "prototypes");
    if (deps.fs.existsSync(protoBaseDir)) {
      const protoEntries = deps.fs.readdirSync(protoBaseDir, { withFileTypes: true });
      for (const ent of protoEntries) {
        if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
        const pJsonPath = deps.path.join(protoBaseDir, ent.name, "proto.json");
        if (deps.fs.existsSync(pJsonPath)) {
          const pJson = JSON.parse(deps.fs.readFileSync(pJsonPath, "utf8"));
          if (Array.isArray(pJson.components)) {
            for (const cand of pJson.components) {
              if (!compMap.has(cand.id)) {
                compMap.set(cand.id, {
                  id: cand.id,
                  name: cand.name || cand.id,
                  selector: `app-${cand.id}`,
                  feature: "prototipo",
                  stageOverride: "extracted",
                  inPrototype: true,
                  isExtracted: true,
                  prototype: { id: pJson.id, title: pJson.title },
                });
              }
            }
          }
        }
      }
    }
  } catch {}

  // C. Enriquece todos os componentes com o checklist e etapa deduzida
  const components = [];
  for (const comp of compMap.values()) {
    components.push(enrichComponentStage(comp, context));
  }

  // 3. Protótipos: catálogo explícito e isolado do projeto do Harness.
  const prototypes = designJson?.prototypes || [];

  return {
    ok: true,
    schema: 1,
    hasDesignJson,
    components,
    features: layersData.featuresList,
    prototypes,
    designSystem: {
      mcpServer: profile?.designSystem?.mcpServer || null,
    },
  };
}

module.exports = {
  isSafeHttpsUrl,
  scanDesignSystemFolders,
  scanImplementedComponents,
  loadDesignJson,
  buildDesignIndex,
};

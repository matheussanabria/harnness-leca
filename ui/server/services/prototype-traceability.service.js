// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { generateVanillaNode } = require("./prototype-codegen-vanilla.service");
const { generateAngularTemplateNode } = require("./prototype-codegen-angular.service");
const { generateReactJsxNode } = require("./prototype-codegen-react.service");
const { resolveModularTraceability } = require("./prototype-traceability-modular.service");

/**
 * Carrega o manifesto de registro de Design System do projeto se existir.
 * @param {string} projectDir
 * @param {object} deps
 */
function loadDesignRegistry(projectDir, deps) {
  const registryFile = deps.path.join(projectDir, "design", "ds", "registry.json");
  if (deps.fs.existsSync(registryFile)) {
    try {
      return JSON.parse(deps.fs.readFileSync(registryFile, "utf8"));
    } catch {}
  }
  return { components: [] };
}

/**
 * Localiza a pasta do componente pelo manifesto (o id pode diferir do nome da pasta).
 * @param {string} projectDir
 * @param {string} componentId
 * @param {object} deps
 * @returns {string | null}
 */
function resolveComponentDir(projectDir, componentId, deps) {
  const componentsDir = deps.path.join(projectDir, "design", "ds", "components");
  if (!deps.fs.existsSync(componentsDir)) return null;

  const candidates = [componentId, componentId.replace(/^dis\./, ""), componentId.split(".").pop()];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const dir = deps.path.join(componentsDir, candidate);
    if (deps.fs.existsSync(deps.path.join(dir, "manifest.json"))) return dir;
  }

  try {
    const entries = deps.fs.readdirSync(componentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = deps.path.join(componentsDir, entry.name);
      const manifestFile = deps.path.join(dir, "manifest.json");
      if (!deps.fs.existsSync(manifestFile)) continue;
      try {
        const manifest = JSON.parse(deps.fs.readFileSync(manifestFile, "utf8"));
        if (manifest.id === componentId) return dir;
      } catch {}
    }
  } catch {}
  return null;
}

/**
 * Procura o componente no registry/disco para enriquecer protótipos modulares.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {object} deps
 */
function lookupComponent(projectDir, componentId, deps) {
  const registry = loadDesignRegistry(projectDir, deps);
  const meta = Array.isArray(registry.components)
    ? registry.components.find((c) => c.id === componentId)
    : (registry.components?.[componentId] || null);
  const dir = resolveComponentDir(projectDir, componentId, deps);
  if (!meta && !dir) return null;
  let manifest = null;
  if (dir) {
    try { manifest = JSON.parse(deps.fs.readFileSync(deps.path.join(dir, "manifest.json"), "utf8")); } catch {}
  }
  const files = buildFileMap(componentId, null, "", manifest, meta, dir);
  return { meta, manifest, manifestPath: files.manifest, components: files.components };
}

/**
 * Resolve o grafo de rastreabilidade completo para um nó de uma tela de protótipo.
 * Grafo: Tela -> Nó Semântico -> Componente no Registry -> Código nos 3 Frameworks.
 * @param {string} projectDir
 * @param {string} protoId
 * @param {string} screenId
 * @param {string} nodeId
 * @param {object} [deps]
 */
function resolveNodeTraceability(projectDir, protoId, screenId, nodeId, deps = { fs, path }) {
  const baseDir = getPrototypesBaseDir(projectDir, deps);
  const protoDir = deps.path.join(baseDir, protoId);

  const protoFile = deps.path.join(protoDir, "proto.json");
  if (!deps.fs.existsSync(protoFile)) {
    throw new Error(`Protótipo '${protoId}' não encontrado.`);
  }

  const proto = JSON.parse(deps.fs.readFileSync(protoFile, "utf8"));
  if (Array.isArray(proto.screens)) {
    // Protótipo modular (telas em arquivos HTML): rastreia pelo data-pid.
    return resolveModularTraceability({
      projectDir, protoDir, protoId, proto, screenId, pid: nodeId,
      lookup: (id) => lookupComponent(projectDir, id, deps),
    }, deps);
  }
  const targetScreenId = screenId || proto.metadata?.defaultScreenId || "home";
  const screen = proto.screens?.[targetScreenId];

  if (!screen) {
    throw new Error(`Tela '${targetScreenId}' não encontrada no protótipo '${protoId}'.`);
  }

  const node = screen.nodes?.[nodeId];
  if (!node) {
    throw new Error(`Nó '${nodeId}' não encontrado na tela '${targetScreenId}'.`);
  }

  const componentId = node.componentId || "html.element";
  const registry = loadDesignRegistry(projectDir, deps);
  const registeredComponent = Array.isArray(registry.components)
    ? registry.components.find((c) => c.id === componentId)
    : (registry.components?.[componentId] || null);

  // Carrega o manifest do componente do Design System se existir em disco
  let componentManifest = null;
  const componentDir = resolveComponentDir(projectDir, componentId, deps);
  if (componentDir) {
    const manifestFile = deps.path.join(componentDir, "manifest.json");
    if (deps.fs.existsSync(manifestFile)) {
      try {
        componentManifest = JSON.parse(deps.fs.readFileSync(manifestFile, "utf8"));
      } catch {}
    }
  }

  // Gera os snippets de código para o nó isolado nos 3 frameworks
  const vanillaCode = generateVanillaNode(node, { includeNodeId: true });
  const angularCode = generateAngularTemplateNode(node, { includeNodeId: true });
  const reactCode = generateReactJsxNode(node, { includeNodeId: true });

  return {
    protoId,
    screenId: targetScreenId,
    nodeId,
    node: {
      id: node.id,
      componentId: node.componentId,
      label: node.label || "",
      props: node.props || {},
      bindings: node.bindings || {},
      events: node.events || {},
      childrenCount: Array.isArray(node.children) ? node.children.length : 0,
    },
    component: {
      id: componentId,
      isRegistered: Boolean(registeredComponent),
      registryMeta: registeredComponent,
      manifest: componentManifest,
    },
    files: buildFileMap(componentId, screen, targetScreenId, componentManifest, registeredComponent, componentDir),
    code: {
      vanilla: vanillaCode,
      angular18: angularCode,
      react18: reactCode,
    },
  };
}

/**
 * Mapeia o nó para arquivos de tela, estilo, registry e implementações do componente.
 * @param {string} componentId
 * @param {any} screen
 * @param {string} screenId
 * @param {any} componentManifest
 * @param {any} [registeredComponent]
 * @param {string | null} [componentDir]
 */
function buildFileMap(componentId, screen, screenId, componentManifest, registeredComponent = null, componentDir = null) {
  const screenFile = screen?.htmlFile || screen?.file || `screens/${screenId}.html`;
  const styleFile = screen?.styleFile || "styles/proto.css";
  const components = [];

  const componentFolder = componentDir ? path.basename(componentDir) : null;
  const implementations = componentManifest?.implementations || registeredComponent?.implementations || {};
  for (const [framework, implementation] of Object.entries(implementations)) {
    if (!implementation || !Array.isArray(implementation.files)) continue;
    for (const file of implementation.files) {
      components.push({
        framework,
        path: componentFolder
          ? `design/ds/components/${componentFolder}/${file}`
          : `design/ds/components/${componentId}/${file}`,
        entry: implementation.entryFile === file,
      });
    }
  }

  return {
    screen: screenFile,
    style: styleFile,
    manifest: componentManifest && componentFolder
      ? `design/ds/components/${componentFolder}/manifest.json`
      : null,
    registry: "design/ds/registry.json",
    components,
  };
}

module.exports = {
  resolveNodeTraceability,
};

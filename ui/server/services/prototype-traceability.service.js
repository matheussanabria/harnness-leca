// @ts-check
const fs = require("fs");
const path = require("path");
const { getPrototypesBaseDir } = require("./prototype-storage.service");
const { generateVanillaNode } = require("./prototype-codegen-vanilla.service");
const { generateAngularTemplateNode } = require("./prototype-codegen-angular.service");
const { generateReactJsxNode } = require("./prototype-codegen-react.service");

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
  const compDir = deps.path.join(projectDir, "design", "ds", "components", componentId);
  const manifestFile = deps.path.join(compDir, "manifest.json");
  if (deps.fs.existsSync(manifestFile)) {
    try {
      componentManifest = JSON.parse(deps.fs.readFileSync(manifestFile, "utf8"));
    } catch {}
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
    code: {
      vanilla: vanillaCode,
      angular18: angularCode,
      react18: reactCode,
    },
  };
}

module.exports = {
  resolveNodeTraceability,
};

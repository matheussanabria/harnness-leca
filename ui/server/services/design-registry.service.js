// @ts-check
const fs = require("fs");
const path = require("path");

/**
 * Valida o manifesto de um componente do Design System.
 * @param {any} comp
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateComponentManifest(comp) {
  const errors = [];
  if (!comp || typeof comp !== "object") {
    return { valid: false, errors: ["Componente deve ser um objeto válido."] };
  }
  if (!comp.id || typeof comp.id !== "string" || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(comp.id)) {
    errors.push("ID do componente inválido. Deve seguir o formato '<namespace>.<kebab-name>' (ex: 'dis.annotation-list').");
  }
  if (!comp.name || typeof comp.name !== "string") {
    errors.push("Nome do componente é obrigatório.");
  }
  if (!comp.category || typeof comp.category !== "string") {
    errors.push("Categoria do componente é obrigatória.");
  }
  if (comp.props && typeof comp.props !== "object") {
    errors.push("Props deve ser um objeto mapeado.");
  }
  if (comp.implementations && typeof comp.implementations !== "object") {
    errors.push("Implementations deve ser um objeto mapeado.");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Retorna o caminho do arquivo de registry do projeto.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function getRegistryFilePath(projectDir, deps = { path }) {
  return deps.path.join(projectDir, "design", "ds", "registry.json");
}

/**
 * Diretório global do harness. Mesma convenção de design-profile-resolver.
 * @param {string} projectDir
 * @param {string} [globalDir]
 * @param {object} [deps]
 */
function resolveGlobalDir(projectDir, globalDir = "", deps = { path }) {
  return globalDir || deps.path.resolve(projectDir, "..", "..", "global");
}

/**
 * Caminho do registry do Design System global (padrão de todos os projetos).
 * @param {string} globalDir
 * @param {object} [deps]
 */
function getGlobalRegistryFilePath(globalDir, deps = { path }) {
  return deps.path.join(globalDir, "design", "ds", "registry.json");
}

/**
 * Lê um registry do disco. Devolve null quando não existe ou está inválido,
 * para o chamador distinguir "não tem" de "tem e está vazio".
 * @param {string} file
 * @param {object} [deps]
 */
function readRegistryFile(file, deps = { fs }) {
  if (!deps.fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(deps.fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    return {
      schema: data.schema || 1,
      namespace: data.namespace || "ds",
      components: data.components || {},
    };
  } catch {
    return null;
  }
}

/**
 * Registry do próprio projeto, sem o global. É esta camada que se grava.
 * @param {string} projectDir
 * @param {object} [deps]
 */
function loadProjectRegistry(projectDir, deps = { fs, path }) {
  return readRegistryFile(getRegistryFilePath(projectDir, deps), deps) || { schema: 1, namespace: "ds", components: {} };
}

/**
 * Registry do Design System global.
 * @param {string} globalDir
 * @param {object} [deps]
 */
function loadGlobalRegistry(globalDir, deps = { fs, path }) {
  return readRegistryFile(getGlobalRegistryFilePath(globalDir, deps), deps) || { schema: 1, namespace: "ds", components: {} };
}

const marcarOrigem = (components, origin) =>
  Object.fromEntries(Object.entries(components || {}).map(([id, comp]) => [id, { ...comp, origin }]));

/**
 * Carrega o registro de componentes visível para um projeto:
 * o Design System global por baixo, o do projeto por cima.
 *
 * Um projeto sem registry próprio enxerga o global inteiro; um projeto com
 * registry próprio (Procempa, por exemplo) sobrescreve componente a componente,
 * pelo id. Cada componente leva `origin: "global" | "projeto"`.
 *
 * @param {string} projectDir
 * @param {object} [deps]
 * @param {{ globalDir?: string, scope?: "merged" | "projeto" | "global" }} [options]
 * @returns {{ schema: number, namespace: string, components: Record<string, any> }}
 */
function loadRegistry(projectDir, deps = { fs, path }, options = {}) {
  const scope = options.scope || "merged";
  const globalDir = resolveGlobalDir(projectDir, options.globalDir, deps);
  if (scope === "projeto") return loadProjectRegistry(projectDir, deps);
  if (scope === "global") return loadGlobalRegistry(globalDir, deps);

  const global = loadGlobalRegistry(globalDir, deps);
  const projeto = readRegistryFile(getRegistryFilePath(projectDir, deps), deps);
  if (!projeto) {
    return { schema: global.schema, namespace: global.namespace, components: marcarOrigem(global.components, "global") };
  }
  return {
    schema: projeto.schema || global.schema,
    // o namespace do projeto manda; sem ele, o do global
    namespace: projeto.namespace || global.namespace,
    components: { ...marcarOrigem(global.components, "global"), ...marcarOrigem(projeto.components, "projeto") },
  };
}

/**
 * Salva o registro do projeto. Nunca escreve no global: o Design System
 * global só muda por quem o mantém, não por um projeto que o consome.
 * @param {string} projectDir
 * @param {object} registryData
 * @param {object} [deps]
 */
function saveRegistry(projectDir, registryData, deps = { fs, path }) {
  const file = getRegistryFilePath(projectDir, deps);
  const dir = deps.path.dirname(file);
  if (!deps.fs.existsSync(dir)) {
    deps.fs.mkdirSync(dir, { recursive: true });
  }
  const limpos = Object.fromEntries(
    Object.entries(registryData.components || {}).map(([id, comp]) => {
      const { origin, ...resto } = comp || {};
      return [id, resto];
    }),
  );
  const payload = {
    schema: 1,
    namespace: registryData.namespace || "ds",
    updatedAt: new Date().toISOString(),
    components: limpos,
  };
  deps.fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

/**
 * Registra ou atualiza um componente no registry do projeto.
 * Parte da camada do projeto, nunca da mesclada, senão o primeiro salvamento
 * copiaria o Design System global inteiro para dentro do projeto.
 * @param {string} projectDir
 * @param {any} componentManifest
 * @param {object} [deps]
 */
function registerComponent(projectDir, componentManifest, deps = { fs, path }) {
  const check = validateComponentManifest(componentManifest);
  if (!check.valid) {
    throw new Error(`Manifesto inválido: ${check.errors.join("; ")}`);
  }
  const reg = loadProjectRegistry(projectDir, deps);
  const compId = componentManifest.id;
  const existing = reg.components[compId] || {};

  const full = {
    id: compId,
    version: componentManifest.version || existing.version || "1.0.0",
    name: componentManifest.name,
    category: componentManifest.category,
    description: componentManifest.description || "",
    props: componentManifest.props || {},
    slots: componentManifest.slots || {},
    events: componentManifest.events || {},
    tokensUsed: componentManifest.tokensUsed || [],
    dependencies: componentManifest.dependencies || [],
    implementations: {
      vanilla: null,
      angular: null,
      react: null,
      ...(existing.implementations || {}),
      ...(componentManifest.implementations || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  reg.components[compId] = full;
  saveRegistry(projectDir, reg, deps);
  return full;
}

/**
 * Busca um componente por ID, considerando o global e o projeto.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {object} [deps]
 * @param {{ globalDir?: string }} [options]
 */
function getComponent(projectDir, componentId, deps = { fs, path }, options = {}) {
  const reg = loadRegistry(projectDir, deps, options);
  return reg.components[componentId] || null;
}

/**
 * Lista os componentes visíveis para o projeto, com filtros opcionais.
 * @param {string} projectDir
 * @param {object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.framework]
 * @param {"global"|"projeto"} [filters.origin]
 * @param {object} [deps]
 * @param {{ globalDir?: string }} [options]
 */
function listRegistryComponents(projectDir, filters = {}, deps = { fs, path }, options = {}) {
  const reg = loadRegistry(projectDir, deps, options);
  const list = Object.values(reg.components);
  return list.filter((comp) => {
    if (filters.category && comp.category !== filters.category) return false;
    if (filters.origin && comp.origin !== filters.origin) return false;
    if (filters.framework) {
      const impl = comp.implementations?.[filters.framework];
      if (!impl || impl.status === "none") return false;
    }
    return true;
  });
}

/**
 * Registra uma implementação de framework. Em componente herdado do global,
 * a gravação cria a sobrescrita local: o projeto passa a ter a sua versão.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {'vanilla'|'angular'|'react'} framework
 * @param {object} implementationData
 * @param {object} [deps]
 * @param {{ globalDir?: string }} [options]
 */
function registerImplementation(projectDir, componentId, framework, implementationData, deps = { fs, path }, options = {}) {
  const visivel = loadRegistry(projectDir, deps, options);
  const base = visivel.components[componentId];
  if (!base) {
    throw new Error(`Componente '${componentId}' não encontrado no Registry.`);
  }
  if (!["vanilla", "angular", "react"].includes(framework)) {
    throw new Error(`Framework '${framework}' não suportado.`);
  }

  const reg = loadProjectRegistry(projectDir, deps);
  if (!reg.namespace || reg.namespace === "ds") reg.namespace = visivel.namespace;
  const { origin, ...semOrigem } = base;
  const comp = reg.components[componentId] || semOrigem;

  comp.implementations = comp.implementations || { vanilla: null, angular: null, react: null };
  comp.implementations[framework] = {
    framework,
    entryFile: implementationData.entryFile || "",
    files: implementationData.files || [],
    dependencies: implementationData.dependencies || [],
    styles: implementationData.styles || [],
    status: implementationData.status || "available",
    lastValidatedAt: implementationData.lastValidatedAt || new Date().toISOString(),
  };

  comp.updatedAt = new Date().toISOString();
  reg.components[componentId] = comp;
  saveRegistry(projectDir, reg, deps);
  return comp;
}

module.exports = {
  validateComponentManifest,
  getRegistryFilePath,
  getGlobalRegistryFilePath,
  resolveGlobalDir,
  loadRegistry,
  loadProjectRegistry,
  loadGlobalRegistry,
  saveRegistry,
  registerComponent,
  getComponent,
  listRegistryComponents,
  registerImplementation,
};

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
 * Carrega o registro de componentes de um projeto.
 * @param {string} projectDir
 * @param {object} [deps]
 * @returns {{ schema: number, namespace: string, components: Record<string, any> }}
 */
function loadRegistry(projectDir, deps = { fs, path }) {
  const file = getRegistryFilePath(projectDir, deps);
  if (!deps.fs.existsSync(file)) {
    return { schema: 1, namespace: "ds", components: {} };
  }
  try {
    const raw = deps.fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    return {
      schema: data.schema || 1,
      namespace: data.namespace || "ds",
      components: data.components || {},
    };
  } catch (err) {
    return { schema: 1, namespace: "ds", components: {} };
  }
}

/**
 * Salva o registro de componentes do projeto no disco.
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
  const payload = {
    schema: 1,
    namespace: registryData.namespace || "ds",
    updatedAt: new Date().toISOString(),
    components: registryData.components || {},
  };
  deps.fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

/**
 * Registra ou atualiza um componente no Registry.
 * @param {string} projectDir
 * @param {any} componentManifest
 * @param {object} [deps]
 */
function registerComponent(projectDir, componentManifest, deps = { fs, path }) {
  const check = validateComponentManifest(componentManifest);
  if (!check.valid) {
    throw new Error(`Manifesto inválido: ${check.errors.join("; ")}`);
  }
  const reg = loadRegistry(projectDir, deps);
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
 * Busca um componente específico por ID no Registry.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {object} [deps]
 */
function getComponent(projectDir, componentId, deps = { fs, path }) {
  const reg = loadRegistry(projectDir, deps);
  return reg.components[componentId] || null;
}

/**
 * Lista todos os componentes do Registry com filtros opcionais.
 * @param {string} projectDir
 * @param {object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.framework]
 * @param {object} [deps]
 */
function listRegistryComponents(projectDir, filters = {}, deps = { fs, path }) {
  const reg = loadRegistry(projectDir, deps);
  const list = Object.values(reg.components);
  return list.filter((comp) => {
    if (filters.category && comp.category !== filters.category) return false;
    if (filters.framework) {
      const impl = comp.implementations?.[filters.framework];
      if (!impl || impl.status === "none") return false;
    }
    return true;
  });
}

/**
 * Registra ou atualiza uma implementação de framework em um componente existente.
 * @param {string} projectDir
 * @param {string} componentId
 * @param {'vanilla'|'angular'|'react'} framework
 * @param {object} implementationData
 * @param {object} [deps]
 */
function registerImplementation(projectDir, componentId, framework, implementationData, deps = { fs, path }) {
  const reg = loadRegistry(projectDir, deps);
  const comp = reg.components[componentId];
  if (!comp) {
    throw new Error(`Componente '${componentId}' não encontrado no Registry.`);
  }
  if (!["vanilla", "angular", "react"].includes(framework)) {
    throw new Error(`Framework '${framework}' não suportado.`);
  }

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
  saveRegistry(projectDir, reg, deps);
  return comp;
}

module.exports = {
  validateComponentManifest,
  getRegistryFilePath,
  loadRegistry,
  saveRegistry,
  registerComponent,
  getComponent,
  listRegistryComponents,
  registerImplementation,
};

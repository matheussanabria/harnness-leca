// @ts-check
const fs = require("fs");
const path = require("path");
const { resolveProjectDesignProfile } = require("./design-profile-resolver.service");
const { createDesignSystemProvider } = require("./design-system-provider.factory");
const { createFrameworkAdapter } = require("./framework-adapter.factory");
const { createLayersProvider } = require("./layers-provider.factory");

/** @type {Map<string, { mtime: number, context: any }>} */
const contextCache = new Map();

/**
 * Monta o contexto consolidado de design de um projeto específico.
 * @param {string} slug
 * @param {string} projectDir
 * @param {string} repoRoot
 * @param {object} [options]
 */
function getProjectDesignContext(slug, projectDir, repoRoot, options = {}) {
  const deps = options.deps || { fs, path };
  const profilePath = deps.path.join(projectDir, "design", "profile.json");
  let mtime = 0;
  try {
    if (deps.fs.existsSync(profilePath)) {
      mtime = deps.fs.statSync(profilePath).mtimeMs;
    }
  } catch {}

  const cacheKey = `${slug}:${mtime}`;
  if (!options.forceRefresh && contextCache.has(cacheKey)) {
    return contextCache.get(cacheKey).context;
  }

  // 1. Resolve o perfil em 3 camadas
  const profile = resolveProjectDesignProfile(projectDir, options.globalDir, deps);

  // 2. Instancia os adaptadores através das portas
  const dsProvider = createDesignSystemProvider(profile.designSystem, repoRoot, deps);
  const frameworkAdapter = createFrameworkAdapter(profile.framework);
  const layersProvider = createLayersProvider(profile.docs, repoRoot, deps);

  // 3. Calcula pastas permitidas do repositório dinamicamente
  const allowedDirs = new Set([
    ...dsProvider.getAllowedDirs(),
    ...layersProvider.getAllowedDirs(),
    ...(profile.designSystem?.allowedRepoDirs || []),
  ]);

  // 4. Mapeamento de ações e agentes por estágio
  const stageActions = profile.stages?.actions || {};
  const stageAgents = profile.agents?.map || {};

  const context = {
    slug,
    projectDir,
    repoRoot,
    profile,
    dsProvider,
    frameworkAdapter,
    layersProvider,
    allowedRepoDirs: Array.from(allowedDirs),
    stageActions,
    stageAgents,
  };

  contextCache.set(cacheKey, { mtime, context });
  return context;
}

/**
 * Limpa o cache de contexto de um projeto.
 * @param {string} [slug]
 */
function invalidateProjectDesignContext(slug) {
  if (slug) {
    for (const key of contextCache.keys()) {
      if (key.startsWith(`${slug}:`)) contextCache.delete(key);
    }
  } else {
    contextCache.clear();
  }
}

module.exports = {
  getProjectDesignContext,
  invalidateProjectDesignContext,
};

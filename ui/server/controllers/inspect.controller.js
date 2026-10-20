// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { resolveComponent, readComponentFile, listComponents } = require("../services/component-resolver.service");

/**
 * Obtém a pasta raiz do repositório e o diretório de trabalho do app.
 * @param {string} slug
 */
function getProjectRepoInfo(slug) {
  const dir = path.join(getProjects(), slug);
  let repo = null;
  let cwd = "";

  const mcpJsonFile = path.join(dir, "mcp.json");
  if (fs.existsSync(mcpJsonFile)) {
    try {
      const mcpCfg = JSON.parse(fs.readFileSync(mcpJsonFile, "utf8").replace(/^\uFEFF/, ""));
      if (mcpCfg && mcpCfg.repo) repo = mcpCfg.repo;
    } catch {}
  }

  const appJsonFile = path.join(dir, "app.json");
  if (fs.existsSync(appJsonFile)) {
    try {
      const appCfg = JSON.parse(fs.readFileSync(appJsonFile, "utf8").replace(/^\uFEFF/, ""));
      if (appCfg && appCfg.cwd) cwd = appCfg.cwd;
      if (!repo && appCfg && appCfg.repo) repo = appCfg.repo;
    } catch {}
  }

  return { repo, cwd };
}

/**
 * GET /api/project/:slug/inspect/resolve?component=<ClassName>
 * @param {any} ctx
 */
async function apiProjectInspectResolve({ req, res, params: [slug] }) {
  const url = new URL(req.url, "http://x");
  const componentName = url.searchParams.get("component");

  if (!componentName) {
    return send(res, 400, { error: "Parâmetro 'component' é obrigatório" });
  }

  const { repo, cwd } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 400, {
      error: `Projeto '${slug}' não possui repositório configurado em mcp.json (campo 'repo').`,
    });
  }

  try {
    const result = resolveComponent(repo, componentName, { appCwd: cwd });
    if (!result.found) {
      return send(res, 404, {
        error: `Componente '${componentName}' não foi encontrado no repositório.`,
        className: componentName,
      });
    }
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * GET /api/project/:slug/inspect/file?path=<relativePath>
 * @param {any} ctx
 */
async function apiProjectInspectFile({ req, res, params: [slug] }) {
  const url = new URL(req.url, "http://x");
  const relativePath = url.searchParams.get("path");

  if (!relativePath) {
    return send(res, 400, { error: "Parâmetro 'path' é obrigatório" });
  }

  const { repo } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 400, {
      error: `Projeto '${slug}' não possui repositório configurado em mcp.json (campo 'repo').`,
    });
  }

  try {
    const result = readComponentFile(repo, relativePath);
    return send(res, 200, result);
  } catch (err) {
    const status = err.message && err.message.includes("Acesso negado") ? 403 : 400;
    return send(res, status, { error: err.message || String(err) });
  }
}

/**
 * GET /api/project/:slug/inspect/components
 * @param {any} ctx
 */
async function apiProjectInspectComponents({ req, res, params: [slug] }) {
  const { repo, cwd } = getProjectRepoInfo(slug);
  if (!repo) {
    return send(res, 400, {
      error: `Projeto '${slug}' não possui repositório configurado em mcp.json (campo 'repo').`,
    });
  }

  try {
    const components = listComponents(repo, { appCwd: cwd });
    return send(res, 200, { ok: true, components, total: components.length });
  } catch (err) {
    return send(res, 500, { error: err.message || String(err) });
  }
}

module.exports = {
  getProjectRepoInfo,
  apiProjectInspectResolve,
  apiProjectInspectFile,
  apiProjectInspectComponents,
};

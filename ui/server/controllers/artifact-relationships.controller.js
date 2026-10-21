// @ts-check
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send, readJsonBody } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { getProjectScreens } = require("../services/project-screens.service");
const { inventoryProjectArtifacts } = require("../services/artifact-inventory.service");
const {
  buildRelationshipReport,
  collectRelationshipTargets,
  setArtifactRelationship,
} = require("../services/artifact-relationships.service");

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

function projectContext(slug, includeLocal) {
  if (!SLUG.test(String(slug || ""))) {
    return { error: { status: 400, message: "Identificador de projeto inválido." } };
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return { error: { status: 404, message: `Projeto '${slug}' não encontrado.` } };
  }
  try {
    const { repo } = getProjectRepoInfo(slug);
    const screens = getProjectScreens(slug, repo || projectDir, projectDir).screens || [];
    const targetInfo = collectRelationshipTargets(screens);
    const inventory = inventoryProjectArtifacts(projectDir, { slug, includeLocal, limit: 5000 });
    const allowed = new Set((inventory.items || []).map((item) => item.key));
    return { projectDir, targetInfo, allowed, warnings: inventory.warnings || [] };
  } catch (err) {
    // @ts-ignore
    return { error: { status: 400, message: err.message || String(err) } };
  }
}

/** GET /api/project/:slug/artifacts/relationships */
async function apiProjectArtifactsRelationships({ req, res, params: [slug] }) {
  const local = !req || netLib.isLocalhostRequest(req);
  const context = projectContext(slug, local);
  if (context.error) return send(res, context.error.status, { error: context.error.message });
  const report = buildRelationshipReport(context.projectDir, context.targetInfo, context.allowed);
  return send(res, 200, { ...report, canManage: local, warnings: [...context.warnings, ...report.warnings] });
}

/** POST /api/project/:slug/artifacts/relationships */
async function apiProjectArtifactsRelationshipsUpdate({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Os vínculos só podem ser alterados no computador local." });
  }
  const context = projectContext(slug, true);
  if (context.error) return send(res, context.error.status, { error: context.error.message });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido." });
  }
  try {
    const report = setArtifactRelationship(context.projectDir, body, context.targetInfo, context.allowed);
    return send(res, 200, { ...report, canManage: true, warnings: context.warnings });
  } catch (err) {
    // @ts-ignore
    const status = Number(err?.status) || 500;
    const message = status >= 500 ? "Falha ao atualizar os vínculos do artefato." : err.message;
    return send(res, status, { error: message });
  }
}

module.exports = {
  apiProjectArtifactsRelationships,
  apiProjectArtifactsRelationshipsUpdate,
};

// @ts-check
// Controller dos vínculos de skills por projeto e raia (EP-08.03).
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const skillsLib = require("../../../tools/lib/skills");
const { getProjects, send, readJsonBody } = require("../config");
const { getCanonicalLanes } = require("../services/project-scrum-lanes");
const { buildBindingReport, setSkillBinding } = require("../services/skill-bindings.service");

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

function projectContext(slug) {
  if (!SLUG.test(String(slug || ""))) {
    return { error: { status: 400, message: "Identificador de projeto inválido." } };
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return { error: { status: 404, message: `Projeto '${slug}' não encontrado.` } };
  }
  const lanes = getCanonicalLanes();
  const skillKeys = new Set(
    (skillsLib.listProjectSkills(slug).skills || []).map((skill) => `${skill.targetId}:${skill.name}`),
  );
  return { projectDir, lanes, skillKeys };
}

/** GET /api/project/:slug/skill-bindings */
async function apiProjectSkillBindings({ req, res, params: [slug] }) {
  const local = !req || netLib.isLocalhostRequest(req);
  const context = projectContext(slug);
  if (context.error) return send(res, context.error.status, { error: context.error.message });
  const report = buildBindingReport(context.projectDir, context.lanes, context.skillKeys);
  return send(res, 200, { ...report, canManage: local });
}

/** POST /api/project/:slug/skill-bindings */
async function apiProjectSkillBindingsUpdate({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Os vínculos de skills só podem ser alterados no computador local." });
  }
  const context = projectContext(slug);
  if (context.error) return send(res, context.error.status, { error: context.error.message });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido." });
  }
  try {
    const report = setSkillBinding(context.projectDir, body, context.lanes, context.skillKeys);
    return send(res, 200, { ...report, canManage: true });
  } catch (err) {
    // @ts-ignore
    const status = Number(err?.status) || 500;
    const message = status >= 500 ? "Falha ao atualizar os vínculos de skills." : err.message;
    return send(res, status, { error: message });
  }
}

module.exports = {
  apiProjectSkillBindings,
  apiProjectSkillBindingsUpdate,
};

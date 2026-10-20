// @ts-check
const { slugs, send, readJsonBody } = require("../config");
const skillsLib = require("../../../tools/lib/skills");

const apiProjectSkillsGet = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, skillsLib.listProjectSkills(slug));
};

const apiProjectSkillsTemplates = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, skillsLib.TEMPLATES_CATALOG);
};

const apiProjectSkillsDetail = ({ res, url, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const targetId = url.searchParams.get("target") || "";
  const name = url.searchParams.get("name") || "";
  if (!targetId || !name) return send(res, 400, { error: "target e name são obrigatórios" });
  const detail = skillsLib.getSkillDetail(slug, targetId, name);
  if (!detail) return send(res, 404, { error: "skill não encontrada" });
  return send(res, 200, detail);
};

async function apiProjectSkillsSave({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { targetId, name, content, frontmatter, references } = body;
  if (!targetId || !name) return send(res, 400, { error: "targetId e name são obrigatórios" });
  try {
    const saved = skillsLib.saveSkill(slug, targetId, name, { content, frontmatter, references });
    return send(res, 200, { ok: true, skill: saved });
  } catch (err) {
    console.error("[skills/save]", err);
    return send(res, 500, { error: err.message || "Erro ao salvar skill" });
  }
}

async function apiProjectSkillsInstall({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { targetId, templateName, options } = body;
  if (!targetId || !templateName) return send(res, 400, { error: "targetId e templateName são obrigatórios" });
  try {
    const result = skillsLib.installTemplate(slug, targetId, templateName, options);
    return send(res, 200, result);
  } catch (err) {
    console.error("[skills/install]", err);
    return send(res, 500, { error: err.message || "Erro ao instalar template de skill" });
  }
}

const apiProjectSkillsRecognized = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, skillsLib.listRecognizedSkills(slug));
};

async function apiProjectSkillsImportRecognized({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { targetId, skillName, sourcePath } = body;
  if (!targetId || !skillName) return send(res, 400, { error: "targetId e skillName são obrigatórios" });
  try {
    const result = skillsLib.importRecognizedSkill(slug, targetId, skillName, sourcePath);
    return send(res, 200, result);
  } catch (err) {
    console.error("[skills/import-recognized]", err);
    return send(res, 500, { error: err.message || "Erro ao importar skill reconhecida" });
  }
}

async function apiProjectSkillsDelete({ req, res, url, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let targetId = url.searchParams.get("target") || "";
  let name = url.searchParams.get("name") || "";
  if (!targetId || !name) {
    try {
      const body = await readJsonBody(req);
      targetId = body.targetId || targetId;
      name = body.name || name;
    } catch {}
  }
  if (!targetId || !name) return send(res, 400, { error: "targetId e name são obrigatórios" });
  try {
    const ok = skillsLib.deleteSkill(slug, targetId, name);
    return send(res, 200, { ok });
  } catch (err) {
    console.error("[skills/delete]", err);
    return send(res, 500, { error: err.message || "Erro ao remover skill" });
  }
}

module.exports = {
  apiProjectSkillsGet,
  apiProjectSkillsTemplates,
  apiProjectSkillsDetail,
  apiProjectSkillsSave,
  apiProjectSkillsInstall,
  apiProjectSkillsRecognized,
  apiProjectSkillsImportRecognized,
  apiProjectSkillsDelete,
};

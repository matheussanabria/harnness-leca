// @ts-check
// Controller do pipeline de estados de teste (EP-11.02).
const fs = require("fs");
const path = require("path");
const { send, readJsonBody, getProjects } = require("../config");
const netLib = require("../../../tools/lib/network");
const { getProjectRepoInfo } = require("../controllers/inspect.controller");
const {
  listPipeline,
  generateTest,
  executeTest,
  approveTest,
} = require("../services/audit/audit-pipeline.service");

function projectDir(slug) {
  const dir = path.join(getProjects(), String(slug || "").trim());
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : "";
  } catch {
    return "";
  }
}

function respondError(res, err) {
  return send(res, err.status || 500, { error: err.message || "Falha na operacao." });
}

/**
 * Prepara os parametros comuns das acoes do pipeline.
 * @param {string} slug
 */
function context(slug) {
  const dir = projectDir(slug);
  const { repo } = getProjectRepoInfo(slug);
  return { dir, repo: repo || dir };
}

/** GET /api/project/:slug/audit/pipeline */
function apiProjectAuditPipeline({ res, params: [slug] }) {
  const { dir, repo } = context(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  try {
    return send(res, 200, listPipeline({ slug, repoRoot: repo, projectDir: dir }));
  } catch (err) {
    return respondError(res, err);
  }
}

/**
 * Le o corpo JSON e exige tela e regra.
 * @param {any} req
 * @param {any} res
 */
async function readPayload(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    send(res, 400, { error: "JSON invalido" });
    return null;
  }
  if (!body || typeof body !== "object") {
    send(res, 400, { error: "JSON invalido" });
    return null;
  }
  if (!body.screenId || !body.ruleTitle) {
    send(res, 400, { error: "Informe screenId e ruleTitle." });
    return null;
  }
  return body;
}

/** POST /api/project/:slug/audit/evidence/generate */
async function apiProjectAuditEvidenceGenerate({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) return send(res, 403, { error: "Geracao de teste restrita ao host local." });
  const body = await readPayload(req, res);
  if (!body) return;
  const { dir, repo } = context(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  try {
    return send(res, 200, generateTest({
      slug,
      repoRoot: repo,
      projectDir: dir,
      screenId: body.screenId,
      ruleTitle: body.ruleTitle,
      kind: body.kind,
      actor: body.actor,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/project/:slug/audit/evidence/execute */
async function apiProjectAuditEvidenceExecute({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) return send(res, 403, { error: "Execucao de teste restrita ao host local." });
  const body = await readPayload(req, res);
  if (!body) return;
  const { dir, repo } = context(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  try {
    return send(res, 200, executeTest({
      slug,
      repoRoot: repo,
      projectDir: dir,
      screenId: body.screenId,
      ruleTitle: body.ruleTitle,
      actor: body.actor,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/project/:slug/audit/evidence/approve */
async function apiProjectAuditEvidenceApprove({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) return send(res, 403, { error: "Aprovacao restrita ao host local." });
  const body = await readPayload(req, res);
  if (!body) return;
  const { dir, repo } = context(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  try {
    return send(res, 200, approveTest({
      slug,
      repoRoot: repo,
      projectDir: dir,
      screenId: body.screenId,
      ruleTitle: body.ruleTitle,
      actor: body.actor,
      note: body.note,
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiProjectAuditPipeline,
  apiProjectAuditEvidenceGenerate,
  apiProjectAuditEvidenceExecute,
  apiProjectAuditEvidenceApprove,
};

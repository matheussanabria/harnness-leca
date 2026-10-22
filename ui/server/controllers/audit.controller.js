// @ts-check
// Controller da matriz de auditoria com evidencias (EP-11.01).
const fs = require("fs");
const path = require("path");
const { send, readJsonBody, getProjects } = require("../config");
const netLib = require("../../../tools/lib/network");
const { getProjectRepoInfo } = require("../controllers/inspect.controller");
const { buildAuditMatrix } = require("../services/audit/audit-matrix.service");
const { buildComponentAudit } = require("../services/audit/component-audit.service");
const { listEvidence, recordEvidence } = require("../services/audit/evidence-recorder.service");

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

/** GET /api/project/:slug/audit/matrix */
function apiProjectAuditMatrix({ res, params: [slug], url }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  const { repo } = getProjectRepoInfo(slug);
  try {
    return send(res, 200, buildAuditMatrix({
      slug,
      repoRoot: repo || dir,
      projectDir: dir,
      state: url.searchParams.get("state") || "",
      screenId: url.searchParams.get("screenId") || "",
      query: url.searchParams.get("q") || "",
    }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/project/:slug/audit/components */
function apiProjectAuditComponents({ res, params: [slug] }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  const { repo } = getProjectRepoInfo(slug);
  try {
    return send(res, 200, buildComponentAudit({ slug, repoRoot: repo || dir, projectDir: dir }));
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/project/:slug/audit/evidence */
function apiProjectAuditEvidence({ res, params: [slug] }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  try {
    const result = listEvidence(dir);
    return send(res, 200, { records: result.records, warnings: result.warnings, totals: { records: result.records.length } });
  } catch (err) {
    return respondError(res, err);
  }
}

/** GET /api/project/:slug/audit/summary */
function apiProjectAuditSummary({ res, params: [slug] }) {
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  const { repo } = getProjectRepoInfo(slug);
  try {
    const matrix = buildAuditMatrix({ slug, repoRoot: repo || dir, projectDir: dir });
    return send(res, 200, { summary: matrix.summary, totals: matrix.totals, legacy: matrix.legacy, warnings: matrix.warnings });
  } catch (err) {
    return respondError(res, err);
  }
}

/** POST /api/project/:slug/audit/evidence */
async function apiProjectAuditEvidenceSave({ req, res, params: [slug] }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Registro de evidencia restrito ao host local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON invalido" });
  }
  if (!body || typeof body !== "object") return send(res, 400, { error: "JSON invalido" });
  const dir = projectDir(slug);
  if (!dir) return send(res, 404, { error: "Projeto nao encontrado." });
  if (!body.screenId || !body.ruleTitle) {
    return send(res, 400, { error: "Informe screenId e ruleTitle." });
  }
  try {
    const record = recordEvidence({
      projectDir: dir,
      screenId: body.screenId,
      ruleTitle: body.ruleTitle,
      screenName: body.screenName,
      state: body.state,
      kind: body.kind,
      evidence: body.evidence,
      note: body.note,
    });
    return send(res, 200, { ok: true, record });
  } catch (err) {
    return respondError(res, err);
  }
}

module.exports = {
  apiProjectAuditMatrix,
  apiProjectAuditEvidence,
  apiProjectAuditSummary,
  apiProjectAuditComponents,
  apiProjectAuditEvidenceSave,
};

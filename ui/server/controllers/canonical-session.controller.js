// @ts-check
// API do registro canônico de sessões (EP-09.01).
// Leitura do registro e vínculo explícito, este último restrito ao loopback.

const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send, readJsonBody } = require("../config");
const registry = require("../services/canonical-sessions/session-registry.service");
const { scanProject, readCentral } = require("../services/canonical-sessions/session-registry-orchestrator.service");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/**
 * @param {any} req
 * @param {string} name
 * @returns {string}
 */
function queryParam(req, name) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    return String(url.searchParams.get(name) || "").trim();
  } catch {
    return "";
  }
}

/**
 * @param {string} slug
 * @returns {boolean}
 */
function projectExists(slug) {
  const dir = path.join(getProjects(), slug);
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** GET /api/project/:slug/sessions */
async function apiProjectSessions({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  try {
    const payload = readCentral(slug, {
      provider: queryParam(req, "provider"),
      executionStatus: queryParam(req, "executionStatus"),
      workflowStatus: queryParam(req, "workflowStatus"),
      attentionStatus: queryParam(req, "attentionStatus"),
      projectConfidence: queryParam(req, "projectConfidence"),
      q: queryParam(req, "q"),
      limit: queryParam(req, "limit"),
      cursor: queryParam(req, "cursor"),
    });
    return send(res, 200, payload);
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

/** POST /api/project/:slug/sessions/scan */
async function apiProjectSessionsScan({ req, res, params: [slug] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Varredura restrita ao loopback." });
  try {
    const result = scanProject(slug);
    return send(res, 200, {
      sessions: result.sessions,
      candidates: result.candidates,
      inserted: result.inserted,
      updated: result.updated,
      warnings: result.warnings,
    });
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

/** GET /api/project/:slug/sessions/:id */
async function apiProjectSession({ req, res, params: [slug, id] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  try {
    const session = registry.getSession(slug, decodeURIComponent(String(id || "")));
    if (!session) return send(res, 404, { error: "Sessão não encontrada." });
    return send(res, 200, { session });
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

/** POST /api/project/:slug/sessions/:id/link */
async function apiProjectSessionLink({ req, res, params: [slug, id] }) {
  if (!SLUG_RE.test(String(slug || ""))) return send(res, 400, { error: "Identificador de projeto inválido." });
  if (!projectExists(slug)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const local = !req || netLib.isLocalhostRequest(req);
  if (!local) return send(res, 403, { error: "Vínculo restrito ao loopback." });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "Corpo inválido." });
  }
  const result = registry.linkSession(slug, decodeURIComponent(String(id || "")), {
    projectId: body?.projectId,
    evidence: body?.evidence,
    actor: body?.actor,
  });
  if (!result.ok) return send(res, 400, { error: result.error });
  return send(res, 200, { session: result.session });
}

module.exports = { apiProjectSessions, apiProjectSessionsScan, apiProjectSession, apiProjectSessionLink };

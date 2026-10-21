// @ts-check
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send, readJsonBody } = require("../config");
const { updateArtifactAccess } = require("../services/artifact-metadata.service");

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/** POST /api/project/:slug/artifacts/access */
async function apiProjectArtifactsAccess({ req, res, params: [slug] }) {
  if (!SLUG.test(String(slug || ""))) {
    return send(res, 400, { error: "Identificador de projeto inválido." });
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "O controle de acesso só pode ser alterado no computador local." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido." });
  }
  if (!body || typeof body.file !== "string" || typeof body.access !== "string") {
    return send(res, 400, { error: "Arquivo e nível de acesso são obrigatórios." });
  }
  try {
    return send(res, 200, updateArtifactAccess(projectDir, body.file, body.access));
  } catch (err) {
    // @ts-ignore
    const status = Number(err?.status) || 500;
    const message = status >= 500 ? "Falha ao atualizar o acesso do artefato." : err.message;
    return send(res, status, { error: message });
  }
}

module.exports = { apiProjectArtifactsAccess };

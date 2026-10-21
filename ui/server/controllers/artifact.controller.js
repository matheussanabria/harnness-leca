// @ts-check
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send } = require("../config");
const { inventoryProjectArtifacts } = require("../services/artifact-inventory.service");

/** GET /api/project/:slug/artifacts */
async function apiProjectArtifacts({ req, res, params: [slug] }) {
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(String(slug || ""))) {
    return send(res, 400, { error: "Identificador de projeto inválido." });
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }
  try {
    const local = !req || netLib.isLocalhostRequest(req);
    const payload = inventoryProjectArtifacts(projectDir, { slug, includeLocal: local });
    return send(res, 200, { ...payload, canManageAccess: local });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

module.exports = { apiProjectArtifacts };

// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { importArtifact } = require("../services/artifact-import.service");

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

/** POST /api/project/:slug/artifacts/import?name=<arquivo>&folder=<pasta> */
async function apiProjectArtifactsImport({ req, res, params: [slug], url }) {
  if (!SLUG.test(String(slug || ""))) {
    return send(res, 400, { error: "Identificador de projeto inválido." });
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }
  const name = url.searchParams.get("name") || "";
  if (!name) return send(res, 400, { error: "Nome do arquivo não informado." });

  try {
    const result = await importArtifact(projectDir, {
      name,
      folder: url.searchParams.get("folder") || "",
      source: url.searchParams.get("source") === "folder" ? "folder" : "files",
      req,
    });
    return send(res, 201, result);
  } catch (err) {
    // @ts-ignore
    const status = Number(err?.status) || 500;
    const message = status >= 500 ? "Falha ao importar o arquivo." : err.message;
    return send(res, status, { error: message });
  }
}

module.exports = { apiProjectArtifactsImport };

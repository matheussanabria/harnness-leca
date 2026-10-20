// @ts-check
const { send, readJsonBody } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const {
  resolveWorkspace,
  listSourceFiles,
  readSourceFile,
  saveSourceFile,
} = require("../services/source-workspace.service");

function getWorkspace(slug) {
  const { repo, cwd } = getProjectRepoInfo(slug);
  if (!repo) throw new Error(`Projeto '${slug}' não possui repositório configurado.`);
  return resolveWorkspace(repo, cwd);
}

async function apiProjectSourceFiles({ res, params: [slug] }) {
  try {
    const files = listSourceFiles(getWorkspace(slug));
    return send(res, 200, { ok: true, files, total: files.length });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

async function apiProjectSourceFileGet({ req, res, params: [slug] }) {
  const url = new URL(req.url, "http://x");
  try {
    return send(res, 200, { ok: true, ...readSourceFile(getWorkspace(slug), url.searchParams.get("path")) });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

async function apiProjectSourceFileSave({ req, res, params: [slug] }) {
  const body = await readJsonBody(req);
  if (!body || !body.path || typeof body.content !== "string") {
    return send(res, 400, { error: "Campos obrigatórios: path, content e fingerprint." });
  }
  try {
    const result = saveSourceFile(getWorkspace(slug), body.path, body.content, body.fingerprint);
    return send(res, 200, { ok: true, ...result });
  } catch (err) {
    const status = err.code === "CONFLICT_409" ? 409 : 400;
    return send(res, status, { error: err.message || String(err) });
  }
}

module.exports = { apiProjectSourceFiles, apiProjectSourceFileGet, apiProjectSourceFileSave };

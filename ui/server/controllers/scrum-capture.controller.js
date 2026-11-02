// @ts-check
// Draft capture and duplicate suggestions. Behind the same PIN gate as every other /api route.
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { captureStory, suggestDuplicates } = require("../services/project-scrum-capture");

const MAX_BODY_BYTES = 256 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) reject(new Error("Corpo da requisição excede o limite máximo permitido."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido no corpo da requisição."));
      }
    });
    req.on("error", reject);
  });
}

function resolveProject(res, slug) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
    return null;
  }
  const { repo } = getProjectRepoInfo(slug);
  return { projectDir, repoRoot: repo || projectDir };
}

/** POST /api/project/:slug/scrum/story/capture @param {any} ctx */
async function apiProjectScrumStoryCapture({ req, res, params: [slug] }) {
  const project = resolveProject(res, slug);
  if (!project) return;
  try {
    const payload = await readJsonBody(req);
    const result = captureStory(slug, project.projectDir, project.repoRoot, payload);
    return send(res, result.duplicated ? 200 : 201, { ok: true, ...result });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/scrum/duplicates?title= @param {any} ctx */
async function apiProjectScrumDuplicates({ url, res, params: [slug] }) {
  const project = resolveProject(res, slug);
  if (!project) return;
  try {
    const query = Object.fromEntries(url.searchParams);
    const candidates = suggestDuplicates(slug, project.projectDir, project.repoRoot, query);
    return send(res, 200, { ok: true, candidates });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

module.exports = { apiProjectScrumStoryCapture, apiProjectScrumDuplicates };

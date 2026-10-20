// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const {
  loadProjectScrum,
  upsertStory,
  updateStoryStatus,
  assignStorySprint,
  deleteStory,
  upsertEpic,
  upsertSprint,
  updateStatusMapping,
  updateLanes,
  reorderLanes,
} = require("../services/project-scrum.service");

/**
 * Lê o corpo da requisição JSON.
 * @param {any} req
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Corpo da requisição excede o limite máximo permitido."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("JSON inválido no corpo da requisição."));
      }
    });
    req.on("error", reject);
  });
}

/**
 * GET /api/project/:slug/scrum
 * @param {any} ctx
 */
async function apiProjectScrumGet({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  const { repo } = getProjectRepoInfo(slug);
  try {
    const result = loadProjectScrum(slug, projectDir, repo || projectDir);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 500, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/story
 * @param {any} ctx
 */
async function apiProjectScrumStorySave({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const payload = await readJsonBody(req);
    const { repo } = getProjectRepoInfo(slug);
    const result = upsertStory(slug, projectDir, repo || projectDir, payload);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/story/status
 * @param {any} ctx
 */
async function apiProjectScrumStoryStatus({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const { storyId, status } = await readJsonBody(req);
    if (!storyId || !status) {
      return send(res, 400, { error: "Parâmetros 'storyId' e 'status' são obrigatórios." });
    }
    const { repo } = getProjectRepoInfo(slug);
    const result = updateStoryStatus(slug, projectDir, repo || projectDir, storyId, status);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/story/assign-sprint
 * @param {any} ctx
 */
async function apiProjectScrumStoryAssignSprint({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const { storyId, sprintId } = await readJsonBody(req);
    if (!storyId) {
      return send(res, 400, { error: "Parâmetro 'storyId' é obrigatório." });
    }
    const { repo } = getProjectRepoInfo(slug);
    const result = assignStorySprint(slug, projectDir, repo || projectDir, storyId, sprintId);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/story/delete
 * @param {any} ctx
 */
async function apiProjectScrumStoryDelete({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const { storyId } = await readJsonBody(req);
    if (!storyId) {
      return send(res, 400, { error: "Parâmetro 'storyId' é obrigatório." });
    }
    const { repo } = getProjectRepoInfo(slug);
    const result = deleteStory(slug, projectDir, repo || projectDir, storyId);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/epic
 * @param {any} ctx
 */
async function apiProjectScrumEpicSave({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const payload = await readJsonBody(req);
    const { repo } = getProjectRepoInfo(slug);
    const result = upsertEpic(slug, projectDir, repo || projectDir, payload);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/scrum/sprint
 * @param {any} ctx
 */
async function apiProjectScrumSprintSave({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  try {
    const payload = await readJsonBody(req);
    const { repo } = getProjectRepoInfo(slug);
    const result = upsertSprint(slug, projectDir, repo || projectDir, payload);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

async function apiProjectScrumStatusMappingSave({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' nao encontrado.` });
  try {
    const { mapping } = await readJsonBody(req);
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      return send(res, 400, { error: "O mapeamento de status e obrigatorio." });
    }
    const { repo } = getProjectRepoInfo(slug);
    return send(res, 200, updateStatusMapping(slug, projectDir, repo || projectDir, mapping));
  } catch (error) {
    return send(res, 400, { error: error.message || String(error) });
  }
}

/** POST /api/project/:slug/scrum/lanes */
async function apiProjectScrumLanesSave({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' nao encontrado.` });
  try {
    const { lanes, expectedRevision } = await readJsonBody(req);
    const { repo } = getProjectRepoInfo(slug);
    return send(res, 200, updateLanes(slug, projectDir, repo || projectDir, lanes, expectedRevision));
  } catch (error) {
    const status = error.code === "SCRUM_LANES_CONFLICT" ? 409 : 400;
    return send(res, status, { error: error.message || String(error), currentRevision: error.currentRevision });
  }
}

/** POST /api/project/:slug/scrum/lanes/order */
async function apiProjectScrumLanesOrder({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' nao encontrado.` });
  try {
    const { laneIds, expectedRevision } = await readJsonBody(req);
    const { repo } = getProjectRepoInfo(slug);
    return send(res, 200, reorderLanes(slug, projectDir, repo || projectDir, laneIds, expectedRevision));
  } catch (error) {
    const status = error.code === "SCRUM_LANES_CONFLICT" ? 409 : 400;
    return send(res, status, { error: error.message || String(error), currentRevision: error.currentRevision });
  }
}

module.exports = {
  apiProjectScrumGet,
  apiProjectScrumStorySave,
  apiProjectScrumStoryStatus,
  apiProjectScrumStoryAssignSprint,
  apiProjectScrumStoryDelete,
  apiProjectScrumEpicSave,
  apiProjectScrumSprintSave,
  apiProjectScrumStatusMappingSave,
  apiProjectScrumLanesSave,
  apiProjectScrumLanesOrder,
};

// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { moveStoryToLane } = require("../services/project-scrum.service");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) reject(new Error("Corpo da requisição excede o limite máximo permitido."));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("JSON inválido no corpo da requisição.")); }
    });
    req.on("error", reject);
  });
}

async function apiProjectScrumStoryTransition({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  try {
    const { storyId, fromLaneId, toLaneId } = await readJsonBody(req);
    if (!storyId || !fromLaneId || !toLaneId) {
      return send(res, 400, { error: "Parâmetros 'storyId', 'fromLaneId' e 'toLaneId' são obrigatórios." });
    }
    const { repo } = getProjectRepoInfo(slug);
    return send(res, 200, moveStoryToLane(slug, projectDir, repo || projectDir, storyId, fromLaneId, toLaneId));
  } catch (error) {
    if (error.code === "SCRUM_STORY_CONFLICT") {
      return send(res, 409, { error: error.message, currentLaneId: error.currentLaneId });
    }
    return send(res, 400, { error: error.message || String(error) });
  }
}

module.exports = { apiProjectScrumStoryTransition };

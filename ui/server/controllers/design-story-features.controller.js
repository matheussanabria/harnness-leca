// @ts-check
// GET /api/project/:slug/design/story-features: funcionalidades e telas do mapa por historia.
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { getProjectScreens } = require("../services/project-screens.service");
const { readStoryFeatures } = require("../services/story-features.service");

async function apiProjectDesignStoryFeatures({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  const repoRoot = repo || projectDir;
  const screens = getProjectScreens(slug, repoRoot, projectDir).screens || [];
  return send(res, 200, readStoryFeatures(repoRoot, screens));
}

module.exports = { apiProjectDesignStoryFeatures };

// @ts-check
// GET /api/project/:slug/design/story-files: story -> files history for the Layers map panel.
const path = require("node:path");
const { getProjects, send } = require("../config");
const { scopeDirExists } = require("../scope/scope-dir");
const { getProjectRepoInfo } = require("./inspect.controller");
const { readStoryFiles } = require("../services/story-files.service");

async function apiProjectDesignStoryFiles({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!scopeDirExists(slug, projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  return send(res, 200, readStoryFiles(repo || projectDir));
}

module.exports = { apiProjectDesignStoryFiles };

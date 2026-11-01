// @ts-check
// Evidencias de uma historia: commits com trailer "Story:" e avaliacao mecanica de Definition of Ready (somente leitura).
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { loadProjectScrum } = require("../services/project-scrum.service");
const { readStoryCommits } = require("../services/project-scrum-commits");
const { evaluateDor } = require("../services/project-scrum-dor");

/** Resolve projeto e historia; responde 404 e devolve null quando algum nao existe. */
function resolveStory(res, slug, storyId) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) {
    send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
    return null;
  }
  const { repo } = getProjectRepoInfo(slug);
  const { scrum } = loadProjectScrum(slug, projectDir, repo || projectDir);
  const story = scrum.stories.find((item) => item.id === storyId || item.key === storyId);
  if (!story) {
    send(res, 404, { error: `Historia '${storyId}' não encontrada.` });
    return null;
  }
  return { story, repo };
}

/**
 * GET /api/project/:slug/scrum/story/:storyId/commits
 * So usa o repositorio configurado do projeto: a pasta projects/<slug> fica dentro do repositorio do proprio Harness
 * e nunca e o codigo da historia.
 * @param {any} ctx
 */
async function apiProjectScrumStoryCommits({ res, params: [slug, storyId] }) {
  try {
    const found = resolveStory(res, slug, storyId);
    if (!found) return;
    const result = readStoryCommits(found.repo, [found.story.id, found.story.key]);
    return send(res, 200, { ok: true, storyId: found.story.id, ...result });
  } catch (err) {
    return send(res, 500, { error: err.message || String(err) });
  }
}

/**
 * GET /api/project/:slug/scrum/story/:storyId/dor
 * @param {any} ctx
 */
async function apiProjectScrumStoryDor({ res, params: [slug, storyId] }) {
  try {
    const found = resolveStory(res, slug, storyId);
    if (!found) return;
    return send(res, 200, { ok: true, storyId: found.story.id, maturity: found.story.maturity, dor: evaluateDor(found.story) });
  } catch (err) {
    return send(res, 500, { error: err.message || String(err) });
  }
}

module.exports = { apiProjectScrumStoryCommits, apiProjectScrumStoryDor };

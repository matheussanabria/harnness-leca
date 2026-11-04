// @ts-check
// GET /api/project/:slug/scrum/panel: read-only office panel data. Writes nothing.
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { loadProjectScrum } = require("../services/project-scrum.service");
const { readStoryCommits } = require("../services/project-scrum-commits");
const { buildCoordinationView, readLedger } = require("../services/coordination-view");
const { buildScrumPanel } = require("../services/scrum-panel");
const { CANONICAL_LANES } = require("../services/project-scrum-lanes");

/** @param {any} ctx */
async function apiProjectScrumPanel({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  try {
    const { repo } = getProjectRepoInfo(slug);
    const stories = loadProjectScrum(slug, projectDir, repo || projectDir).scrum.stories;
    const state = readLedger(getProjects(), slug);
    const ledgerLanes = state ? buildCoordinationView(state).lanes : [];
    const ids = stories.flatMap((s) => [s.id, s.key]).filter(Boolean).slice(0, 200);
    const git = repo ? readStoryCommits(repo, ids, { maxCount: 500 }) : { available: false, commits: [] };
    const panel = buildScrumPanel({ stories, ledgerLanes, commits: git.commits || [], laneOrder: CANONICAL_LANES.map((l) => l.id) });
    return send(res, 200, { ok: true, ledger: Boolean(state), commits: Boolean(git.available), ...panel });
  } catch (err) {
    return send(res, 500, { error: `Falha ao montar o painel de Scrum: ${/** @type {Error} */ (err).message}` });
  }
}

module.exports = { apiProjectScrumPanel };

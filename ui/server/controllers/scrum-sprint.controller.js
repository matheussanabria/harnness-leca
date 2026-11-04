// @ts-check
// POST /api/project/:slug/scrum/sprint/:id/start and /close: sprint lifecycle. 400 = rule broken, 409 = another sprint is running.
const fs = require("fs");
const path = require("path");
const { getProjects, send, readJsonBody } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { startSprint, closeSprint } = require("../services/project-scrum-sprints");

/** @param {(slug: string, dir: string, repo: string, id: string, options: any) => any} action */
function lifecycleHandler(action) {
  /** @param {any} ctx */
  return async function handler({ req, res, params: [slug, sprintId] }) {
    const projectDir = path.join(getProjects(), slug);
    if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
    try {
      const body = await readJsonBody(req);
      const { repo } = getProjectRepoInfo(slug);
      return send(res, 200, action(slug, projectDir, repo || projectDir, sprintId, body && typeof body === "object" ? body : {}));
    } catch (error) {
      const status = error.code === "SCRUM_SPRINT_CONFLICT" ? 409 : 400;
      return send(res, status, { error: error.message || String(error) });
    }
  };
}

const apiProjectScrumSprintStart = lifecycleHandler(startSprint);
const apiProjectScrumSprintClose = lifecycleHandler(closeSprint);

module.exports = { apiProjectScrumSprintStart, apiProjectScrumSprintClose };

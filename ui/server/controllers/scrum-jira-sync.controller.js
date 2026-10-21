// @ts-check
// Atualiza o snapshot do Jira a pedido da aba Scrum; credenciais so do ambiente do servidor.
const fs = require("fs");
const path = require("path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { loadProjectScrum } = require("../services/project-scrum.service");
const { exportJiraSnapshot } = require("../../../tools/lib/jira-export");

const JIRA_PROJECT = "DIS";
let running = false;

/** POST /api/project/:slug/scrum/jira-sync */
async function apiProjectScrumJiraSync({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' nao encontrado.` });
  const baseUrl = process.env.JIRA_BASE_URL;
  const token = process.env.JIRA_PAT;
  if (!baseUrl || !token) {
    return send(res, 400, { error: "Defina JIRA_BASE_URL e JIRA_PAT no ambiente e reinicie o Harness." });
  }
  if (running) return send(res, 409, { error: "Uma sincronizacao com o Jira ja esta em andamento." });
  const { repo } = getProjectRepoInfo(slug);
  if (!repo) return send(res, 400, { error: "Repositorio do projeto nao encontrado." });
  running = true;
  try {
    const out = path.join(repo, "doc", "scrum", `_jira-${JIRA_PROJECT.toLowerCase()}.json`);
    const summary = await exportJiraSnapshot({ baseUrl, token, project: JIRA_PROJECT, out });
    return send(res, 200, { ...loadProjectScrum(slug, projectDir, repo), sync: summary });
  } catch (error) {
    return send(res, 502, { error: error.message || String(error) });
  } finally {
    running = false;
  }
}

module.exports = { apiProjectScrumJiraSync };

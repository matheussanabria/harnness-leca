#!/usr/bin/env node
// Exporta issues do Jira para o snapshot do quadro Scrum. Credenciais so por ambiente:
// JIRA_BASE_URL e JIRA_PAT. Uso:
//   node tools/export-jira-snapshot.js --project DIS --out <caminho>/doc/scrum/_jira-dis.json
const path = require("path");
const { exportJiraSnapshot } = require("./lib/jira-export");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
}

const project = arg("project", "DIS");
exportJiraSnapshot({
  baseUrl: process.env.JIRA_BASE_URL || "",
  token: process.env.JIRA_PAT || "",
  project,
  out: path.resolve(arg("out", `doc/scrum/_jira-${project.toLowerCase()}.json`)),
  onProgress: (done, total) => console.log(`${done}/${total}`),
}).then((result) => {
  if (!result.sprintFieldFound) console.warn("Aviso: campo Sprint nao encontrado; sprints ficarao ausentes.");
  console.log(`Gravado ${result.file}: ${result.issues} issues, ${result.withSprint} com sprint, ${result.withComments} com comentarios.`);
}).catch((error) => { console.error(error.message); process.exit(1); });

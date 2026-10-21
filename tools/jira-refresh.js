#!/usr/bin/env node
// @ts-check
// Sincroniza o snapshot do Jira e regenera o panorama do projeto em context/jira-resumo.md.
//
//   node tools/jira-refresh.js --project saude-dispensacao
//   node tools/jira-refresh.js --project saude-dispensacao --dry-run
//
// Credenciais: JIRA_BASE_URL e JIRA_PAT no ambiente. O script nao le segredos de arquivo,
// nao imprime token e nao usa rede fora do Jira. O panorama gerado nao leva comentarios
// nem dados pessoais: quem consulta o Jira usa tools/jira-query.js.
const path = require("path");
const fs = require("fs");
const { exportJiraSnapshot } = require("./lib/jira-export");
const { loadJiraContext } = require("./lib/jira-snapshot");
const { writeSummary } = require("./lib/jira-summary");
const { opt, flag, CliError } = require("./lib/cli");
const { PROJECTS } = require("./lib/proc-manager-store");

function activeSlug() {
  const file = path.join(PROJECTS, ".active");
  if (!fs.existsSync(file)) return "";
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function repoOf(slug) {
  const file = path.join(PROJECTS, slug, "mcp.json");
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    if (data && data.repo && fs.existsSync(data.repo)) return path.resolve(data.repo);
  } catch {}
  return null;
}

async function main(argv, io) {
  const slug = opt("project") || activeSlug();
  if (!slug) throw new CliError("Informe --project <slug> (nenhum projeto ativo em projects/.active).");
  const baseUrl = process.env.JIRA_BASE_URL || "";
  const token = process.env.JIRA_PAT || "";
  if (!baseUrl || !token) throw new CliError("Defina JIRA_BASE_URL e JIRA_PAT no ambiente.");
  const repo = repoOf(slug);
  if (!repo) throw new CliError(`Projeto '${slug}' sem repositório configurado em mcp.json.`);
  const out = path.join(repo, "doc", "scrum", "_jira-dis.json");
  if (flag("dry-run")) {
    io.log(`[dry-run] sincronizaria ${out} e regeraria projects/${slug}/context/jira-resumo.md`);
    return;
  }
  const summary = await exportJiraSnapshot({
    baseUrl,
    token,
    project: opt("jira-project") || "DIS",
    out,
    onProgress: (done, total) => io.log(`${done}/${total}`),
  });
  const ctx = loadJiraContext(slug);
  const target = path.join(ctx.projectDir, "context", "jira-resumo.md");
  writeSummary(ctx, target);
  io.log(`Snapshot: ${summary.issues} issues em ${out}`);
  io.log(`Panorama: ${target}`);
}

if (require.main === module) {
  // main e assincrono: o CliError naso escapa do try/catch de runAsScript.
  main(process.argv.slice(2), console).catch((error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exit(error instanceof CliError ? error.code : 1);
  });
}
module.exports = { main };

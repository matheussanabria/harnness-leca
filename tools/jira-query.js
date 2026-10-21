#!/usr/bin/env node
// @ts-check
// Consulta os dados do Jira do projeto a partir do snapshot local, sem rede e sem token.
//
//   node tools/jira-query.js issue DIS-499
//   node tools/jira-query.js sprint "Sprint 3"
//   node tools/jira-query.js search "saldo terapeutico"
//   node tools/jira-query.js status
//   node tools/jira-query.js summary
//
// Opcoes:
//   --project <slug>   projeto alvo (padrao: o projeto ativo de projects/.active)
//   --json             saida em JSON
//   --raw              NAO redige dados pessoais (uso local; a saida pode conter CPF/CNS)
//   --comments <n>     maximo de comentarios por issue (padrao 3)
//   --limit <n>        maximo de resultados de busca (padrao 20)
//
// Regra do projeto: o PAT do Jira vive so em variavel de ambiente e nunca chega aqui.
// Este script le `doc/scrum/_jira-dis.json` (snapshot gerado por script local) e o quadro local.
const fs = require("fs");
const path = require("path");
const { PROJECTS } = require("../tools/lib/proc-manager-store");
const { flag, opt, CliError, runAsScript } = require("../tools/lib/cli");
const { redact, redactDeep } = require("../tools/lib/jira-redact");
const { buildSummary, writeSummary, statusCounts } = require("../tools/lib/jira-summary");
const {
  loadJiraContext, findIssue, findSprint, findJiraSprint, issueSprint, localStory, sprintStories, searchIssues,
} = require("../tools/lib/jira-snapshot");

function activeSlug() {
  const file = path.join(PROJECTS, ".active");
  if (!fs.existsSync(file)) return "";
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function sprintNameOf(ctx, sprintId) {
  const sprints = Array.isArray(ctx.board.sprints) ? ctx.board.sprints : [];
  const sprint = sprints.find((item) => item.id === sprintId);
  if (!sprint) return null;
  const active = ctx.board.activeSprintId === sprint.id ? " (ativa)" : "";
  return `${sprint.name}${active}`;
}

function laneNameOf(ctx, laneId) {
  const lanes = Array.isArray(ctx.board.lanes) ? ctx.board.lanes : [];
  const lane = lanes.find((item) => item.id === laneId);
  return lane ? lane.name : (laneId || null);
}

function issueLines(ctx, issue, { comments = 3, raw = false } = {}) {
  const local = localStory(ctx, issue.key);
  const lines = [];
  lines.push(`${issue.key} — ${redact(issue.title, { raw })}`);
  const lane = local ? laneNameOf(ctx, local.laneId) : null;
  lines.push(`Tipo: ${issue.type} | Status Jira: ${issue.status.name}${issue.status.category ? ` (${issue.status.category})` : ""}${lane ? ` | Raia local: ${lane}` : ""}`);
  const sprint = local && local.sprintId ? sprintNameOf(ctx, local.sprintId) : null;
  const jiraSprint = issueSprint(issue);
  const extras = [];
  if (issue.epic) extras.push(`Épico: ${issue.epic}`);
  if (issue.assignee) extras.push(`Responsável: ${issue.assignee}`);
  if (issue.priority) extras.push(`Prioridade: ${issue.priority}`);
  if (local && local.points !== null && local.points !== undefined) extras.push(`Pontos: ${local.points}`);
  if (jiraSprint) extras.push(`Sprint Jira: ${jiraSprint.name}${jiraSprint.state ? ` (${jiraSprint.state})` : ""}`);
  if (sprint) extras.push(`Sprint local: ${sprint}`);
  if (extras.length) lines.push(extras.join(" | "));
  if (issue.links.length) {
    lines.push("Vínculos:");
    for (const link of issue.links) {
      lines.push(`  - ${link.relation} ${link.key}${link.status ? ` (${link.status})` : ""} — ${redact(link.title, { raw })}`);
    }
  }
  if (issue.comments.length) {
    const shown = issue.comments.slice(-comments);
    lines.push(`Comentários (${issue.comments.length}${shown.length < issue.comments.length ? `, mostrando ${shown.length} últimos` : ""}):`);
    for (const comment of shown) {
      const when = comment.created ? comment.created.slice(0, 10) : "sem data";
      lines.push(`  - ${comment.author} (${when}): ${redact(comment.body, { raw })}`);
    }
  } else {
    lines.push("Comentários: nenhum.");
  }
  return lines;
}

function cmdIssue(ctx, args, options, io) {
  const key = args[0];
  if (!key) throw new CliError("Uso: jira-query.js issue <CHAVE>");
  const issue = findIssue(ctx, key);
  if (!issue) {
    const local = localStory(ctx, key);
    if (!local) throw new CliError(`Issue '${key}' não encontrada no snapshot nem no quadro local.`);
    io.log(`${local.key} — ${redact(local.title || "", options)} (apenas no quadro local; não está no snapshot)`);
    return;
  }
  if (options.json) {
    io.log(JSON.stringify(redactDeep(issue, options), null, 2));
    return;
  }
  io.log(issueLines(ctx, issue, options).join("\n"));
}

function cmdSprint(ctx, args, options, io) {
  const wanted = args.join(" ").trim();
  if (!wanted) throw new CliError("Uso: jira-query.js sprint <nome ou id>");
  // A sprint do Jira vem primeiro: e a fonte de verdade das historias em execucao.
  const jiraSprint = findJiraSprint(ctx, wanted);
  if (jiraSprint) {
    const rows = jiraSprint.issues.map((key) => {
      const issue = findIssue(ctx, key);
      const local = localStory(ctx, key);
      return {
        key,
        title: redact(issue ? issue.title : "", options),
        jiraStatus: issue ? issue.status.name : "-",
        lane: local ? laneNameOf(ctx, local.laneId) : null,
        points: local ? (local.points ?? null) : null,
      };
    });
    if (options.json) { io.log(JSON.stringify({ sprint: jiraSprint, stories: rows }, null, 2)); return; }
    io.log(`${jiraSprint.name} (Jira ${jiraSprint.jiraId}, ${jiraSprint.state || "sem estado"})`);
    io.log(`${jiraSprint.startDate || "?"} a ${jiraSprint.endDate || "?"} — ${rows.length} história(s)\n`);
    for (const row of rows) {
      io.log(`${row.key}  [${row.lane || "sem raia local"}]  [${row.jiraStatus}]  ${row.points ?? "-"} pts`);
      io.log(`      ${row.title}`);
    }
    return;
  }
  const sprint = findSprint(ctx, wanted);
  if (!sprint) {
    const local = (Array.isArray(ctx.board.sprints) ? ctx.board.sprints : []).map((item) => item.name).join(", ");
    throw new CliError(`Sprint '${wanted}' não encontrada no Jira nem no quadro local. Sprints locais: ${local || "nenhuma"}.`);
  }
  const stories = sprintStories(ctx, sprint);
  const rows = stories.map((story) => {
    const issue = findIssue(ctx, story.key);
    return {
      key: story.key,
      title: redact(story.title || (issue ? issue.title : ""), options),
      jiraStatus: issue ? issue.status.name : "fora do snapshot",
      lane: laneNameOf(ctx, story.laneId),
      points: story.points ?? null,
    };
  });
  if (options.json) { io.log(JSON.stringify({ sprint, stories: rows }, null, 2)); return; }
  io.log(`${sprint.name} (quadro local) — ${sprint.goal || "sem objetivo"} (${sprint.startDate} a ${sprint.endDate})`);
  io.log(`${rows.length} história(s) alocada(s)\n`);
  for (const row of rows) {
    io.log(`${row.key}  [${row.lane || "sem raia"}]  [${row.jiraStatus}]  ${row.points ?? "-"} pts`);
    io.log(`      ${row.title}`);
  }
}

function cmdSearch(ctx, args, options, io) {
  const term = args.join(" ").trim();
  if (!term) throw new CliError("Uso: jira-query.js search <termo>");
  const found = searchIssues(ctx, term, { limit: options.limit });
  if (options.json) {
    io.log(JSON.stringify(found.map((item) => ({ ...redactDeep(item.issue, options), foundIn: item.where })), null, 2));
    return;
  }
  if (!found.length) { io.log(`Nada encontrado para "${term}".`); return; }
  io.log(`${found.length} resultado(s) para "${term}"\n`);
  for (const item of found) {
    io.log(`${item.issue.key}  [${item.issue.status.name}]  (match em ${item.where})`);
    io.log(`      ${redact(item.issue.title, options)}`);
  }
}

function cmdStatus(ctx, options, io) {
  const { byJira, byLane } = statusCounts(ctx);
  if (options.json) {
    io.log(JSON.stringify({
      jira: Object.fromEntries(byJira), local: Object.fromEntries(byLane),
    }, null, 2));
    return;
  }
  io.log("Status no Jira (snapshot):");
  for (const [name, total] of [...byJira].sort((a, b) => b[1] - a[1])) io.log(`  ${String(total).padStart(4)}  ${name}`);
  io.log("\nHistórias por raia do quadro local:");
  for (const [name, total] of [...byLane].sort((a, b) => b[1] - a[1])) io.log(`  ${String(total).padStart(4)}  ${name}`);
}

function cmdSummary(ctx, options, io) {
  const target = path.join(ctx.projectDir, "context", "jira-resumo.md");
  writeSummary(ctx, target, options);
  io.log(`Resumo escrito em ${path.relative(process.cwd(), target)}`);
}

const HELP = [
  "jira-query.js — consulta local do snapshot do Jira (sem rede, sem token)",
  "",
  "  issue <CHAVE>        detalhe de uma história (status, sprint, vínculos, comentários)",
  "  sprint <nome|id>     histórias alocadas na sprint do quadro local",
  "  search <termo>       busca por título, descrição e comentário",
  "  status               contagem por status do Jira e por raia local",
  "  summary              escreve projects/<slug>/context/jira-resumo.md",
  "",
  "Opções: --project <slug> --json --raw --comments <n> --limit <n>",
].join("\n");

/** Separa os posicionais das opcoes: opcoes com valor consomem o argumento seguinte. */
const VALUE_OPTIONS = new Set(["project", "comments", "limit"]);

function positionals(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2).split("=")[0];
      if (VALUE_OPTIONS.has(name) && !arg.includes("=")) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function main(argv, io) {
  const args = positionals(argv);
  const command = args.shift();
  if (!command || command === "ajuda" || flag("help")) { io.log(HELP); return; }
  const slug = opt("project") || activeSlug();
  if (!slug) throw new CliError("Informe --project <slug> (nenhum projeto ativo em projects/.active).");
  const options = {
    json: flag("json"),
    raw: flag("raw"),
    comments: Number(opt("comments") || 3),
    limit: Number(opt("limit") || 20),
  };
  const ctx = loadJiraContext(slug);
  if (command === "issue") cmdIssue(ctx, args, options, io);
  else if (command === "sprint") cmdSprint(ctx, args, options, io);
  else if (command === "search") cmdSearch(ctx, args, options, io);
  else if (command === "status") cmdStatus(ctx, options, io);
  else if (command === "summary") cmdSummary(ctx, options, io);
  else throw new CliError(`Comando desconhecido: '${command}'. Use 'ajuda'.`);
}

if (require.main === module) runAsScript(main);
module.exports = { main, buildSummary };

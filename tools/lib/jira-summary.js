// @ts-check
// Panorama do Jira para a pasta context/ do projeto: sprints, contagem por status e historias ativas.
// É gerado por script (nunca por modelo) e nao leva comentarios nem dados pessoais.
const fs = require("fs");
const path = require("path");
const { redact } = require("./jira-redact");
const { jiraSprints } = require("./jira-snapshot");

function laneNameOf(board, laneId) {
  const lanes = Array.isArray(board.lanes) ? board.lanes : [];
  const lane = lanes.find((item) => item.id === laneId);
  return lane ? lane.name : (laneId || null);
}

function statusCounts(ctx) {
  const byJira = new Map();
  for (const issue of ctx.issues.values()) {
    const name = issue.status.name;
    byJira.set(name, (byJira.get(name) || 0) + 1);
  }
  const byLane = new Map();
  for (const story of Array.isArray(ctx.board.stories) ? ctx.board.stories : []) {
    const name = laneNameOf(ctx.board, story.laneId) || "sem raia";
    byLane.set(name, (byLane.get(name) || 0) + 1);
  }
  return { byJira, byLane };
}

/**
 * Monta o markdown do panorama.
 * @param {{ slug: string, issues: Map<string, any>, board: any, snapshotAt: string|null }} ctx
 * @param {{ raw?: boolean }} [options]
 * @returns {string}
 */
function buildSummary(ctx, options = {}) {
  const { byJira, byLane } = statusCounts(ctx);
  const sprints = Array.isArray(ctx.board.sprints) ? ctx.board.sprints : [];
  const active = sprints.find((sprint) => sprint.id === ctx.board.activeSprintId) || null;
  const lines = [];
  lines.push(`# Panorama do Jira — ${ctx.slug}`);
  lines.push("");
  lines.push(`> Gerado por \`node tools/jira-query.js summary --project ${ctx.slug}\`. Fonte: \`doc/scrum/_jira-dis.json\``);
  lines.push(`> (snapshot de ${ctx.snapshotAt || "data desconhecida"}; ${ctx.issues.size} issues). Sem comentários e sem dados pessoais.`);
  lines.push("");
  lines.push("Use `node tools/jira-query.js issue <CHAVE>` para o detalhe de uma história.");
  lines.push("");
  lines.push("## Contagem por status do Jira");
  lines.push("");
  lines.push("| Status | Issues |");
  lines.push("|---|---|");
  for (const [name, total] of [...byJira].sort((a, b) => b[1] - a[1])) lines.push(`| ${name} | ${total} |`);
  lines.push("");
  lines.push("## Quadro local por raia");
  lines.push("");
  lines.push("| Raia | Histórias |");
  lines.push("|---|---|");
  for (const [name, total] of [...byLane].sort((a, b) => b[1] - a[1])) lines.push(`| ${name} | ${total} |`);
  lines.push("");
  lines.push("## Sprints do Jira");
  lines.push("");
  const jira = [...jiraSprints(ctx).values()].filter((sprint) => sprint.state === "active" || sprint.state === "future");
  if (!jira.length) {
    lines.push("Nenhuma sprint ativa ou futura no snapshot.");
  } else {
    lines.push("| Sprint | Estado | Histórias |");
    lines.push("|---|---|---|");
    for (const sprint of jira.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }))) {
      lines.push(`| ${sprint.name} | ${sprint.state} | ${sprint.issues.length} |`);
    }
  }
  lines.push("");
  lines.push("## Sprints do quadro local");
  lines.push("");
  for (const sprint of sprints) {
    const total = (Array.isArray(ctx.board.stories) ? ctx.board.stories : []).filter((story) => story.sprintId === sprint.id).length;
    const mark = sprint.id === ctx.board.activeSprintId ? " (ativa)" : "";
    lines.push(`- **${sprint.name}**${mark} — ${sprint.startDate} a ${sprint.endDate} — ${total} história(s)${sprint.goal ? ` — ${sprint.goal}` : ""}`);
  }
  if (active) {
    const stories = (Array.isArray(ctx.board.stories) ? ctx.board.stories : []).filter((story) => story.sprintId === active.id);
    lines.push("");
    lines.push(`## Histórias da ${active.name} (sprint ativa)`);
    lines.push("");
    lines.push("| Chave | Raia | Status Jira | Pontos | Título |");
    lines.push("|---|---|---|---|---|");
    for (const story of stories) {
      const issue = ctx.issues.get(String(story.key || "").toUpperCase());
      lines.push(`| ${story.key} | ${laneNameOf(ctx.board, story.laneId) || "-"} | ${issue ? issue.status.name : "-"} | ${story.points ?? "-"} | ${redact(story.title || "", options)} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Escreve o panorama no destino informado e devolve o caminho.
 * @param {object} ctx
 * @param {string} targetFile
 * @param {{ raw?: boolean }} [options]
 * @returns {string} caminho gravado
 */
function writeSummary(ctx, targetFile, options = {}) {
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, buildSummary(ctx, options), "utf8");
  return targetFile;
}

module.exports = { buildSummary, writeSummary, statusCounts };

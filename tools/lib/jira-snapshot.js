// @ts-check
// Leitura local do snapshot do Jira e do quadro local do projeto.
// Regra do projeto: o Harness nao fala com o Jira. A unica fonte e o artefato
// `doc/scrum/_jira-dis.json` gerado por script local com PAT em variavel de ambiente.
// Este modulo nunca abre rede, nunca le credencial e nunca imprime o snapshot inteiro.
const fs = require("fs");
const path = require("path");
const { PROJECTS } = require("./proc-manager-store");

/** @returns {string|null} raiz do repositorio declarada em projects/<slug>/mcp.json */
function repoDirOf(slug) {
  const mcpFile = path.join(PROJECTS, slug, "mcp.json");
  if (!fs.existsSync(mcpFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(mcpFile, "utf8").replace(/^\uFEFF/, ""));
    if (data && data.repo && fs.existsSync(data.repo)) return path.resolve(data.repo);
  } catch {}
  return null;
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
  catch { return null; }
}

/** Minuscula sem acento: a busca ignora "terapeutico" x "terapêutico". */
function fold(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeStatus(status) {
  if (!status) return { name: "Sem status", category: null, id: null };
  return {
    id: status.id ? String(status.id) : null,
    name: String(status.name || "Sem status"),
    category: status.statusCategory?.key ? String(status.statusCategory.key) : null,
  };
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map((link) => {
    const target = link.outwardIssue || link.inwardIssue;
    if (!target) return null;
    const direction = link.outwardIssue ? "outward" : "inward";
    return {
      direction,
      relation: String(link.type?.[direction] || link.type?.name || "relacionada"),
      key: String(target.key || ""),
      title: String(target.fields?.summary || target.key || ""),
      status: target.fields?.status ? String(target.fields.status.name || "") : "",
    };
  }).filter(Boolean);
}

/** Verdadeiro quando o campo traz sprint (texto do Server ou objeto do Cloud). */
function isSprintField(value) {
  const items = Array.isArray(value) ? value : [value];
  if (!items.length) return false;
  return items.every((item) => {
    if (typeof item === "string") return LEGACY_SPRINT.test(item);
    return Boolean(item && typeof item === "object" && item.name && item.id !== undefined);
  });
}

function normalizeIssue(issue) {
  const fields = issue.fields || {};
  const comments = Array.isArray(fields.comment?.comments) ? fields.comment.comments : [];
  const sprintFields = Object.fromEntries(Object.entries(fields)
    .filter(([name, value]) => (name === "sprint" || name.startsWith("customfield_")) && isSprintField(value)));
  return {
    key: String(issue.key || ""),
    id: issue.id ? String(issue.id) : null,
    title: String(fields.summary || ""),
    type: String(fields.issuetype?.name || ""),
    status: normalizeStatus(fields.status),
    epic: fields.customfield_10101 ? String(fields.customfield_10101) : null,
    assignee: fields.assignee?.displayName || fields.assignee?.name || null,
    creator: fields.creator?.displayName || fields.creator?.name || null,
    priority: fields.priority?.name || null,
    description: fields.description ? String(fields.description) : "",
    created: fields.created || null,
    updated: fields.updated || null,
    sprintFields,
    links: normalizeLinks(fields.issuelinks),
    comments: comments.map((comment) => ({
      author: comment.author?.displayName || comment.author?.name || "sem autor",
      created: comment.created || null,
      body: String(comment.body || ""),
    })),
  };
}

/**
 * Carrega o contexto de Jira e o quadro local do projeto.
 * @param {string} slug
 * @returns {{ slug: string, projectDir: string, repoRoot: string, snapshotFile: string, issues: Map<string, any>, board: any, snapshotAt: string|null }}
 */
function loadJiraContext(slug) {
  const projectDir = path.join(PROJECTS, slug);
  if (!fs.existsSync(projectDir)) throw new Error(`Projeto '${slug}' não encontrado em projects/.`);
  const repoRoot = repoDirOf(slug) || projectDir;
  const snapshotFile = path.join(repoRoot, "doc", "scrum", "_jira-dis.json");
  const raw = readJson(snapshotFile);
  const list = Array.isArray(raw) ? raw : [];
  const issues = new Map(list.map((issue) => [String(issue.key || "").toUpperCase(), normalizeIssue(issue)]));
  const board = readJson(path.join(projectDir, "scrum.json")) || {};
  const stat = fs.existsSync(snapshotFile) ? fs.statSync(snapshotFile) : null;
  return {
    slug,
    projectDir,
    repoRoot,
    snapshotFile,
    issues,
    board,
    snapshotAt: stat ? new Date(stat.mtimeMs).toISOString() : null,
  };
}

/** @returns {any|null} a issue do snapshot, pela chave (ex.: DIS-499) */
function findIssue(ctx, key) {
  return ctx.issues.get(String(key || "").trim().toUpperCase()) || null;
}

/** @returns {any|null} o registro local da historia no quadro (scrum.json) */
function localStory(ctx, key) {
  const wanted = String(key || "").trim().toUpperCase();
  const stories = Array.isArray(ctx.board.stories) ? ctx.board.stories : [];
  return stories.find((story) => String(story.key || story.id).toUpperCase() === wanted) || null;
}

/** @returns {any|null} a sprint pelo id ou pelo nome (case-insensitive, parcial) */
function findSprint(ctx, nameOrId) {
  const sprints = Array.isArray(ctx.board.sprints) ? ctx.board.sprints : [];
  const wanted = String(nameOrId || "").trim().toLowerCase();
  if (!wanted) return null;
  return sprints.find((sprint) => String(sprint.id).toLowerCase() === wanted)
    || sprints.find((sprint) => String(sprint.name || "").toLowerCase() === wanted)
    || sprints.find((sprint) => String(sprint.name || "").toLowerCase().includes(wanted))
    || null;
}

/** Historias do quadro local alocadas na sprint; cai para o snapshot quando a sprint e a ativa. */
function sprintStories(ctx, sprint) {
  const stories = Array.isArray(ctx.board.stories) ? ctx.board.stories : [];
  return stories.filter((story) => story.sprintId && story.sprintId === sprint.id);
}

/** Busca por chave, titulo, descricao ou comentario; ignora acentos e caixa. */
function searchIssues(ctx, term, { limit = 20 } = {}) {
  const wanted = fold(term);
  if (!wanted) return [];
  const out = [];
  for (const issue of ctx.issues.values()) {
    const inTitle = fold(issue.title).includes(wanted);
    const inDescription = fold(issue.description).includes(wanted);
    const inComment = issue.comments.some((comment) => fold(comment.body).includes(wanted));
    if (inTitle || inDescription || inComment) {
      out.push({ issue, where: inTitle ? "titulo" : (inDescription ? "descricao" : "comentario") });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// O campo Sprint do Jira vem no formato antigo (texto do Server) ou como objeto (Cloud).
const LEGACY_SPRINT = /Sprint@[0-9a-f]+\[(.*)\]/i;

function parseSprintValue(value) {
  if (value && typeof value === "object") {
    if (value.id === undefined || !value.name) return null;
    return {
      jiraId: String(value.id),
      name: String(value.name),
      state: String(value.state || "").toLowerCase() || null,
      startDate: value.startDate || null,
      endDate: value.endDate || null,
      goal: value.goal || "",
    };
  }
  const text = String(value || "");
  const match = LEGACY_SPRINT.exec(text);
  if (!match) return null;
  const attrs = {};
  for (const part of match[1].split(/,(?=\w+=)/)) {
    const index = part.indexOf("=");
    if (index > 0) attrs[part.slice(0, index)] = part.slice(index + 1);
  }
  if (!attrs.id || !attrs.name) return null;
  return {
    jiraId: String(attrs.id),
    name: String(attrs.name),
    state: String(attrs.state || "").toLowerCase() || null,
    startDate: attrs.startDate && attrs.startDate !== "<null>" ? attrs.startDate : null,
    endDate: attrs.endDate && attrs.endDate !== "<null>" ? attrs.endDate : null,
    goal: attrs.goal && attrs.goal !== "<null>" ? attrs.goal : "",
  };
}

/**
 * Sprints do Jira presentes no snapshot, com as historias de cada uma.
 * @param {object} ctx
 * @returns {Map<string, { jiraId: string, name: string, state: string|null, startDate: string|null, endDate: string|null, goal: string, issues: string[] }>}
 */
function jiraSprints(ctx) {
  const sprints = new Map();
  for (const issue of ctx.issues.values()) {
    for (const [field, value] of Object.entries(issue.sprintFields || {})) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        const sprint = parseSprintValue(item);
        if (!sprint) continue;
        const found = sprints.get(sprint.jiraId) || { ...sprint, issues: [] };
        if (!found.issues.includes(issue.key)) found.issues.push(issue.key);
        sprints.set(sprint.jiraId, found);
      }
    }
  }
  return sprints;
}

/** @returns {any|null} a sprint do Jira pelo id ou pelo nome (ex.: "Sprint 41") */
function findJiraSprint(ctx, nameOrId) {
  const wanted = fold(nameOrId);
  if (!wanted) return null;
  const sprints = [...jiraSprints(ctx).values()];
  return sprints.find((sprint) => fold(sprint.jiraId) === wanted)
    || sprints.find((sprint) => fold(sprint.name) === wanted)
    || sprints.find((sprint) => fold(sprint.name).includes(wanted))
    || null;
}

/** Sprint vigente da historia: a ativa mais recente, senao a mais recente. */
function issueSprint(issue) {
  const list = [];
  for (const value of Object.values((issue && issue.sprintFields) || {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      const sprint = parseSprintValue(item);
      if (sprint) list.push(sprint);
    }
  }
  if (!list.length) return null;
  const byStart = (a, b) => String(a.startDate || "").localeCompare(String(b.startDate || ""));
  const active = list.filter((sprint) => sprint.state === "active").sort(byStart);
  return active.pop() || list.sort(byStart).pop();
}

module.exports = {
  loadJiraContext,
  findIssue,
  findSprint,
  findJiraSprint,
  issueSprint,
  jiraSprints,
  localStory,
  sprintStories,
  searchIssues,
  parseSprintValue,
};

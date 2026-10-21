// @ts-check
// Fonte somente-leitura do snapshot produzido pelo export PowerShell do Jira.
const fs = require("fs");
const path = require("path");

const { extractIssueSprints, currentSprint, isSprintField } = require("./project-scrum-jira-sprints");

const snapshotCache = new Map();

function fold(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeStatus(status = {}) {
  return {
    id: status.id ? String(status.id) : null,
    name: status.name ? String(status.name) : "Sem status",
    category: status.statusCategory?.key ? String(status.statusCategory.key) : null,
  };
}

function normalizeRelationships(links = []) {
  return links.flatMap((link) => {
    const outward = link.outwardIssue;
    const inward = link.inwardIssue;
    const target = outward || inward;
    if (!target) return [];
    const direction = outward ? "outward" : "inward";
    return [{
      id: link.id ? String(link.id) : null,
      direction,
      relation: String(link.type?.[direction] || link.type?.name || "relates to"),
      issue: {
        id: target.id ? String(target.id) : null,
        key: String(target.key || ""),
        title: String(target.fields?.summary || target.key || ""),
        status: target.fields?.status ? normalizeStatus(target.fields.status) : null,
      },
    }];
  });
}

function normalizeIssue(issue, epicKeys, meta) {
  const fields = issue.fields || {};
  const key = String(issue.key || issue.id || "");
  const epicReference = fields.customfield_10101 ? String(fields.customfield_10101) : null;
  const knownFields = new Set(["summary", "issuetype", "status", "issuelinks", "customfield_10101", "description", "project", "priority", "assignee", "creator", "comment", "attachment", "created", "updated"]);
  const unmapped = Object.fromEntries(Object.entries(fields).filter(([name, value]) => !knownFields.has(name) && !isSprintField(value)));
  const sprints = extractIssueSprints(fields);
  return {
    id: key.toLowerCase(),
    jiraId: issue.id ? String(issue.id) : null,
    key,
    title: String(fields.summary || key || "Sem titulo"),
    issueType: fields.issuetype ? {
      id: fields.issuetype.id ? String(fields.issuetype.id) : null,
      name: String(fields.issuetype.name || ""),
      subtask: Boolean(fields.issuetype.subtask),
    } : null,
    sourceStatus: normalizeStatus(fields.status),
    relationships: normalizeRelationships(fields.issuelinks),
    epicId: epicReference && epicKeys.has(epicReference) ? epicReference : null,
    project: fields.project ? { key: fields.project.key || null, name: fields.project.name || null } : { key: meta.project || key.split("-")[0] || null, name: null },
    description: fields.description ? String(fields.description) : null,
    acceptanceCriteria: [],
    scenarios: [],
    points: null,
    priority: fields.priority?.name || null,
    assignee: fields.assignee?.displayName || fields.assignee?.name || null,
    creator: fields.creator?.displayName || fields.creator?.name || null,
    comments: Array.isArray(fields.comment?.comments) ? fields.comment.comments : [],
    attachments: Array.isArray(fields.attachment) ? fields.attachment : [],
    createdAt: fields.created || null,
    updatedAt: fields.updated || null,
    sprintId: currentSprint(sprints)?.id || null,
    jiraSprints: sprints,
    source: "jira-snapshot",
    synchronization: { sourceFile: meta.file || null, exportedAt: meta.exportedAt || null },
    sourceFields: { epicReference, unmapped },
  };
}

/** Normaliza todas as issues sem preencher dados que o snapshot nao contem. */
function normalizeJiraSnapshot(issues, meta = {}) {
  const list = Array.isArray(issues) ? issues : [];
  const snapshotMeta = { ...meta, project: meta.project || String(list[0]?.key || "").split("-")[0] || null };
  const epicKeys = new Set(list
    .filter((issue) => fold(issue.fields?.issuetype?.name).includes("epic"))
    .map((issue) => String(issue.key)));
  const normalized = list.map((issue) => normalizeIssue(issue, epicKeys, snapshotMeta));
  const epics = normalized.filter((issue) => epicKeys.has(issue.key)).map((issue) => ({
    id: issue.key,
    key: issue.key,
    title: issue.title,
    description: null,
    color: "#6366f1",
    source: "jira-snapshot",
    sourceStatus: issue.sourceStatus,
  }));
  const sprintsById = new Map();
  for (const issue of normalized) for (const sprint of issue.jiraSprints) sprintsById.set(sprint.id, sprint);
  return {
    available: true,
    stories: normalized.filter((issue) => !epicKeys.has(issue.key)),
    epics,
    sprints: [...sprintsById.values()],
    meta: { ...snapshotMeta, issueCount: list.length },
  };
}

/** Le o artefato local; nunca acessa rede nem credenciais. */
function loadJiraSnapshot(repoRoot) {
  const file = path.resolve(repoRoot, "doc", "scrum", "_jira-dis.json");
  if (!fs.existsSync(file)) return { available: false, stories: [], epics: [], sprints: [], meta: { file } };
  try {
    const mtimeMs = fs.statSync(file).mtimeMs;
    const cached = snapshotCache.get(file);
    if (cached?.mtimeMs === mtimeMs) return cached.value;
    const issues = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    const value = normalizeJiraSnapshot(issues, {
      file: path.relative(repoRoot, file).replace(/\\/g, "/"),
      exportedAt: new Date(mtimeMs).toISOString(),
    });
    snapshotCache.set(file, { mtimeMs, value });
    return value;
  } catch (error) {
    return { available: false, stories: [], epics: [], meta: { file, error: error.message } };
  }
}

module.exports = { loadJiraSnapshot, normalizeJiraSnapshot };

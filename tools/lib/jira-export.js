// @ts-check
// Exporta issues do Jira (REST v2) para o snapshot lido pelo quadro Scrum.
const fs = require("fs");
const path = require("path");

const BASE_FIELDS = ["summary", "issuetype", "status", "issuelinks", "customfield_10101", "description", "project",
  "priority", "assignee", "creator", "comment", "attachment", "created", "updated"];
const PAGE = 100;

function createClient(baseUrl, token, fetchImpl = fetch) {
  return async function get(route) {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/api/2/${route}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Jira ${response.status} em ${route.split("?")[0]}`);
    return response.json();
  };
}

async function findSprintFields(get) {
  const fields = await get("field");
  return fields.filter((field) => field.custom && /^sprint$/i.test(field.name)).map((field) => field.id);
}

async function completeComments(get, issue) {
  const comment = issue.fields.comment;
  if (comment && comment.total > (comment.comments || []).length) {
    const all = await get(`issue/${issue.key}/comment?maxResults=${comment.total}`);
    issue.fields.comment = { ...comment, comments: all.comments };
  }
}

/**
 * Baixa todas as issues do projeto e grava o snapshot em `out`.
 * @param {{ baseUrl: string, token: string, project: string, out: string, fetchImpl?: typeof fetch, onProgress?: (done: number, total: number) => void }} options
 */
async function exportJiraSnapshot({ baseUrl, token, project, out, fetchImpl, onProgress }) {
  if (!baseUrl || !token) throw new Error("Defina JIRA_BASE_URL e JIRA_PAT no ambiente.");
  const get = createClient(baseUrl, token, fetchImpl);
  const sprintFields = await findSprintFields(get);
  const fields = encodeURIComponent([...BASE_FIELDS, ...sprintFields].join(","));
  const jql = encodeURIComponent(`project = ${project} ORDER BY key ASC`);
  const issues = [];
  for (let start = 0; ; start += PAGE) {
    const page = await get(`search?jql=${jql}&fields=${fields}&startAt=${start}&maxResults=${PAGE}`);
    issues.push(...page.issues);
    if (onProgress) onProgress(issues.length, page.total);
    if (!page.issues.length || issues.length >= page.total) break;
  }
  for (const issue of issues) await completeComments(get, issue);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(issues));
  fs.renameSync(tmp, out);
  return {
    file: out,
    issues: issues.length,
    withSprint: issues.filter((issue) => sprintFields.some((id) => issue.fields[id]?.length)).length,
    withComments: issues.filter((issue) => issue.fields.comment?.comments?.length).length,
    sprintFieldFound: sprintFields.length > 0,
  };
}

module.exports = { exportJiraSnapshot };

// @ts-check
const fs = require("fs");
const path = require("path");
const { getRoot, getProjects, read, slugs, active, send, readJsonBody, inside } = require("../config");
const { project, readProjectGroups } = require("../services/project.service");
const { setActiveProject } = require("../services/project-selection.service");
const suggest = require("../../../tools/lib/suggest");

const apiState = ({ res }) =>
  send(res, 200, {
    active: active(),
    projects: slugs(),
    global: {
      instructions: read(path.join(getRoot(), "global", "instructions.md")),
      memory: read(path.join(getRoot(), "global", "memory.md")),
    },
  });

const apiProject = ({ res, params: [slug] }) =>
  slugs().includes(slug) ? send(res, 200, project(slug)) : send(res, 404, { error: "projeto não encontrado" });

const apiProjectGroupsGet = ({ res, params: [slug] }) => {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, readProjectGroups(slug));
};

async function apiProjectGroupsSave({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const file = path.join(getProjects(), slug, "groups.json");
  try {
    const groups = Array.isArray(body.groups) ? body.groups : [];
    const assignments = typeof body.assignments === "object" && body.assignments !== null ? body.assignments : {};
    fs.writeFileSync(file, JSON.stringify({ groups, assignments }, null, 2), "utf8");
    return send(res, 200, { ok: true, groups, assignments });
  } catch (err) {
    console.error("[groups/save]", err);
    return send(res, 500, { error: "Não foi possível salvar os grupos." });
  }
}

async function apiProjectChatGroupAssign({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { chatName, groupId, group, subgroup, remove } = body;
  if (!chatName) return send(res, 400, { error: "chatName é obrigatório" });
  const file = path.join(getProjects(), slug, "groups.json");
  try {
    const current = readProjectGroups(slug);
    if (!current.assignments) current.assignments = {};
    if (remove || (!group && !groupId)) {
      delete current.assignments[chatName];
    } else {
      current.assignments[chatName] = {
        groupId: groupId || group,
        group: group || groupId,
        subgroup: subgroup || "",
      };
    }
    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
    return send(res, 200, { ok: true, assignment: current.assignments[chatName] || null, assignments: current.assignments });
  } catch (err) {
    console.error("[chat-group/assign]", err);
    return send(res, 500, { error: "Não foi possível atualizar a atribuição do chat." });
  }
}

async function apiProjectGroupsSuggest({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {}
  try {
    if (body.chatName) {
      const chatFile = path.join(getProjects(), slug, "chats", body.chatName);
      if (!fs.existsSync(chatFile)) return send(res, 404, { error: "chat não encontrado" });
      const raw = fs.readFileSync(chatFile, "utf8");
      const titleMatch = raw.match(/^titulo:\s*"(.*?)"/m);
      const title = titleMatch ? titleMatch[1] : body.chatName.replace(/\.md$/, "");
      const groups = suggest.readProjectGroups(slug).groups || [];
      const suggestion = suggest.suggestGroupByHeuristic({ name: body.chatName, title, raw }, groups);
      return send(res, 200, { ok: true, suggestion });
    }

    if (body.apply && Array.isArray(body.items)) {
      const updated = suggest.applyGroupSuggestions(slug, body.items);
      return send(res, 200, { ok: true, ...updated });
    }

    const report = await suggest.classifyProject(slug, { all: !!body.all });
    return send(res, 200, { ok: true, ...report });
  } catch (err) {
    console.error("[groups/suggest]", err);
    return send(res, 500, { error: "Não foi possível sugerir grupos." });
  }
}

// Só <slug>/<chats|context|scheduled>/<arquivo> ou <slug>/<instructions|memory>.md, sem sair de projects/.
function apiFile({ res, url }) {
  const rel = url.searchParams.get("path") || "";
  const projectsDir = getProjects();
  const target = path.resolve(projectsDir, rel);
  const ok = /^[\w-]+\/(chats|context|scheduled)\/[^\/\\]+$|^[\w-]+\/(instructions|memory)\.md$/.test(rel);
  if (!ok || !target.startsWith(projectsDir + path.sep) || !inside(projectsDir, target)) {
    return send(res, 404, { error: "não encontrado" });
  }
  return send(res, 200, { content: read(target) });
}

// Diário de atividade: dias (do mais recente) com sessões, pedidos, arquivos e comandos. ?since=AAAA-MM-DD filtra.
function apiProjectJournal({ res, url, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const since = url.searchParams.get("since") || "";
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return send(res, 400, { error: "since deve ser AAAA-MM-DD" });
  return send(res, 200, { slug, days: require("../../../tools/daily-journal").collect(slug, since || undefined) });
}

// Define o projeto ativo em projects/.active
async function apiProjectActiveSet({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  try {
    const selected = setActiveProject(body && body.slug);
    return send(res, 200, { ok: true, active: selected });
  } catch (err) {
    if (err && err.code === "INVALID_PROJECT") {
      return send(res, 400, { error: err.message });
    }
    console.error("[project/active]", err);
    return send(res, 500, { error: "Não foi possível definir o projeto ativo." });
  }
}

module.exports = {
  apiState,
  apiProject,
  apiProjectActiveSet,
  apiProjectGroupsGet,
  apiProjectGroupsSave,
  apiProjectChatGroupAssign,
  apiProjectGroupsSuggest,
  apiFile,
  apiProjectJournal,
};

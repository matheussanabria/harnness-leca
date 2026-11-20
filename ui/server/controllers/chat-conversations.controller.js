// @ts-check
// Chat conversations API (EP-17.02 RF2). The server resolves a conversation's engine sessions; the browser keeps
// only a cache. With HARNESS_CHAT_STORE=file (rollback) every route answers 503 and the browser falls back to
// its local cache and the .md files.
const { slugs, send, readJsonBody } = require("../config");
const svc = require("../services/chat/conversation.service");

const ID = "([0-9a-f-]{36})";

/** @param {import("http").ServerResponse} res */
function storeOr503(res) {
  const repo = svc.getStore();
  if (!repo) send(res, 503, { error: "O banco de conversas está desligado.", code: "chat_store_off" });
  return repo;
}

/** @param {import("http").IncomingMessage} req @param {import("http").ServerResponse} res @returns {Promise<any|null>} */
async function bodyOr400(req, res) {
  try {
    return await readJsonBody(req);
  } catch {
    send(res, 400, { error: "JSON inválido" });
    return null;
  }
}

const knownProject = (/** @type {unknown} */ slug) => typeof slug === "string" && slugs().includes(slug);

/** GET /api/chat/conversations?project=&file=&archived=1 */
async function apiList({ res, url }) {
  const repo = storeOr503(res);
  if (!repo) return;
  const project = url.searchParams.get("project");
  if (!knownProject(project)) return send(res, 404, { error: "projeto não encontrado" });
  const file = url.searchParams.get("file");
  if (file) {
    const one = svc.conversationForFile(/** @type {string} */ (project), file);
    return one ? send(res, 200, one) : send(res, 404, { error: "conversa não encontrada" });
  }
  const list = repo.listConversations(/** @type {string} */ (project), { includeArchived: url.searchParams.get("archived") === "1" });
  return send(res, 200, { conversations: list.map((c) => svc.describe(repo, c)) });
}

/** POST /api/chat/conversations {project, title?, presentation?} */
async function apiCreate({ req, res }) {
  const repo = storeOr503(res);
  if (!repo) return;
  const body = await bodyOr400(req, res);
  if (!body) return;
  if (!knownProject(body.project)) return send(res, 404, { error: "projeto não encontrado" });
  const title = typeof body.title === "string" ? svc.clean(body.title).slice(0, 200) : null;
  const presentation = typeof body.presentation === "string" ? body.presentation.slice(0, 40) : null;
  return send(res, 201, svc.describe(repo, repo.createConversation({ projectId: body.project, title, presentation })));
}

/** GET /api/chat/conversations/:id?after=&limit= : the conversation and a page of messages by seq. */
async function apiGet({ res, url, params }) {
  const repo = storeOr503(res);
  if (!repo) return;
  const conversation = repo.getConversation(params[0]);
  if (!conversation) return send(res, 404, { error: "conversa não encontrada" });
  const after = Number(url.searchParams.get("after") ?? -1);
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const messages = repo.readMessages(conversation.id, { after: Number.isFinite(after) ? after : -1, limit: Number.isFinite(limit) ? limit : 200 });
  return send(res, 200, { ...svc.describe(repo, conversation), messages });
}

/** PATCH /api/chat/conversations/:id {title?, archived?} */
async function apiPatch({ req, res, params }) {
  const repo = storeOr503(res);
  if (!repo) return;
  const body = await bodyOr400(req, res);
  if (!body) return;
  if (!repo.getConversation(params[0])) return send(res, 404, { error: "conversa não encontrada" });
  /** @type {{ title?: string, archived?: boolean }} */
  const patch = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = svc.clean(body.title.trim()).slice(0, 200);
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  return send(res, 200, svc.describe(repo, /** @type {any} */ (repo.updateConversation(params[0], patch))));
}

/** POST /api/chat/conversations/sessions {project, file, engine, sessionId}: the browser received a new engine session. */
async function apiPutSession({ req, res }) {
  if (!storeOr503(res)) return;
  const body = await bodyOr400(req, res);
  if (!body) return;
  if (!knownProject(body.project)) return send(res, 404, { error: "projeto não encontrado" });
  const result = svc.setSessionForFile(body.project, body.file, body.engine, body.sessionId);
  return result ? send(res, 200, result) : send(res, 400, { error: "arquivo, motor ou sessão inválidos" });
}

/** POST /api/chat/conversations/import-sessions {project, byFile}: one-time import of the browser's session map. */
async function apiImportSessions({ req, res }) {
  if (!storeOr503(res)) return;
  const body = await bodyOr400(req, res);
  if (!body) return;
  if (!knownProject(body.project)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, { imported: svc.importLocalSessions(body.project, body.byFile) });
}

const conversationRoutes = [
  { method: "GET", path: "/api/chat/conversations", handler: apiList },
  { method: "POST", path: "/api/chat/conversations", handler: apiCreate },
  { method: "POST", path: "/api/chat/conversations/sessions", handler: apiPutSession },
  { method: "POST", path: "/api/chat/conversations/import-sessions", handler: apiImportSessions },
  { method: "GET", path: new RegExp(`^/api/chat/conversations/${ID}$`), handler: apiGet },
  { method: "PATCH", path: new RegExp(`^/api/chat/conversations/${ID}$`), handler: apiPatch },
];

module.exports = { conversationRoutes };

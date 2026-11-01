// @ts-check
// Permissões pedidas pelo Claude Code durante o chat (ver tools/lib/permissions.js).
const { slugs, send, readJsonBody } = require("../config");
const perms = require("../../../tools/lib/permissions");

const netLib = require("../../../tools/lib/network");

// Quem pede é a ferramenta MCP que o próprio Claude chama, na mesma máquina: só aceita pedido local direto, sem
// proxy ou túnel (o túnel também conecta do loopback). A resposta (quem decide) passa pelo PIN do acesso remoto como
// o resto da interface, então o celular também aprova.
async function apiPermissionRequest({ req, res }) {
  if (!netLib.isLocalhostRequest(req)) return send(res, 403, { error: "só aceita pedidos locais" });
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  if (typeof body.chatId !== "string" || typeof body.tool !== "string") return send(res, 400, { error: "chatId e tool são obrigatórios" });
  const decision = await perms.request({ chatId: body.chatId, tool: body.tool, input: body.input && typeof body.input === "object" ? body.input : {} });
  return send(res, 200, decision);
}

async function apiPermissionAnswer({ req, res }) {
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  if (typeof body.id !== "string") return send(res, 400, { error: "id é obrigatório" });
  const r = perms.answer(body.id, { decision: body.decision, scope: body.scope });
  return send(res, r.ok ? 200 : 404, r);
}

async function apiProjectPermissionsGet({ res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  return send(res, 200, { allow: perms.listRules(slug) });
}

async function apiProjectPermissionsRemove({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  if (!perms.removeRule(slug, Number(body.index))) return send(res, 404, { error: "regra não encontrada" });
  return send(res, 200, { ok: true, allow: perms.listRules(slug) });
}

module.exports = { apiPermissionRequest, apiPermissionAnswer, apiProjectPermissionsGet, apiProjectPermissionsRemove };

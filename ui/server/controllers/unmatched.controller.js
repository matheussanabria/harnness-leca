// @ts-check
// "Sessões sem projeto": sessions of the engines that the sync could not assign, and the action that assigns one.
const { send, readJsonBody, slugs } = require("../config");
const store = require("../../../tools/lib/unmatched-store");

function apiUnmatchedList({ res }) {
  return send(res, 200, { items: store.list(), projects: slugs() });
}

async function apiUnmatchedAssociate({ req, res }) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido" });
  }
  const { engine, name, slug } = body || {};
  if ([engine, name, slug].some((v) => typeof v !== "string" || !v.trim())) {
    return send(res, 400, { error: "Informe engine, name e slug." });
  }
  const result = store.associate({ engine, name, slug });
  if (!result.ok) return send(res, result.status, { error: result.error });
  return send(res, 200, { ok: true, alias: result.alias, message: "Associada. A próxima sincronização importa essas conversas." });
}

module.exports = { apiUnmatchedList, apiUnmatchedAssociate };

// @ts-check
// Effective skills, agents and workflows of a project, by layer, and creation/removal on the project layer.
const { slugs, send, readJsonBody } = require("../config");
const { resolveLayers } = require("../../../tools/lib/layers/resolve");
const { createItem, deleteItem } = require("../../../tools/lib/layers/writer");
const { getDaiPath } = require("../../../tools/lib/dai");
const { readItem, saveItemFile } = require("../../../tools/lib/layers/content");

const guard = (res, slug) => (slugs().includes(slug) ? true : (send(res, 404, { error: "projeto não encontrado" }), false));

function apiLayersGet({ res, params: [slug] }) {
  if (!guard(res, slug)) return;
  const dai = getDaiPath();
  const { items, disabled } = resolveLayers(slug, { daiPath: dai });
  // editable: the item lives in projects/<slug>/<kind>s/<id>/ (what createItem writes), not in a working repository
  const marked = items.map((i) => ({ ...i, editable: i.layer === "project" && i.file.includes(`/projects/${slug}/${i.kind}s/${i.id}/`) }));
  return send(res, 200, { items: marked, disabled, daiFound: Boolean(dai) });
}

/** @param {boolean} remove */
const mutate = (remove) => async ({ req, res, params: [slug] }) => {
  if (!guard(res, slug)) return;
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  const { kind, id, description } = body || {};
  if (typeof kind !== "string" || typeof id !== "string") return send(res, 400, { error: "Informe kind e id." });
  try {
    if (remove) {
      if (body.confirm !== true) return send(res, 400, { error: "Remoção exige confirm: true." });
      return deleteItem({ slug, kind, id }) ? send(res, 200, { ok: true }) : send(res, 404, { error: "item não encontrado na camada do projeto" });
    }
    return send(res, 201, { ok: true, ...createItem({ slug, kind, id, description }) });
  } catch (err) {
    const msg = String(err && /** @type {any} */ (err).message || err);
    return send(res, /Já existe/.test(msg) ? 409 : 400, { error: msg });
  }
};

function apiLayersContentGet({ res, url, params: [slug] }) {
  if (!guard(res, slug)) return;
  try {
    const item = readItem(slug, url.searchParams.get("kind") || "", url.searchParams.get("id") || "");
    return item ? send(res, 200, item) : send(res, 404, { error: "item não encontrado na camada do projeto" });
  } catch (err) {
    return send(res, 400, { error: String(err && /** @type {any} */ (err).message || err) });
  }
}

async function apiLayersContentSave({ req, res, params: [slug] }) {
  if (!guard(res, slug)) return;
  let body;
  try { body = await readJsonBody(req); } catch { return send(res, 400, { error: "JSON inválido" }); }
  try {
    return send(res, 200, { ok: true, ...saveItemFile({ slug, kind: String(body && body.kind), id: String(body && body.id), file: String(body && body.file), text: body && body.text }) });
  } catch (err) {
    const msg = String(err && /** @type {any} */ (err).message || err);
    return send(res, /não encontrado/.test(msg) ? 404 : 400, { error: msg });
  }
}

module.exports = { apiLayersContentGet, apiLayersContentSave, apiLayersGet, apiLayersCreate: mutate(false), apiLayersDelete: mutate(true) };

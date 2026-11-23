// @ts-check
// Effective skills, agents and workflows of a project, by layer, and creation/removal on the project layer.
const { slugs, send, readJsonBody } = require("../config");
const { resolveLayers } = require("../../../tools/lib/layers/resolve");
const { createItem, deleteItem } = require("../../../tools/lib/layers/writer");
const { getDaiPath } = require("../../../tools/lib/dai");

const guard = (res, slug) => (slugs().includes(slug) ? true : (send(res, 404, { error: "projeto não encontrado" }), false));

function apiLayersGet({ res, params: [slug] }) {
  if (!guard(res, slug)) return;
  const dai = getDaiPath();
  return send(res, 200, { ...resolveLayers(slug, { daiPath: dai }), daiFound: Boolean(dai) });
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

module.exports = { apiLayersGet, apiLayersCreate: mutate(false), apiLayersDelete: mutate(true) };

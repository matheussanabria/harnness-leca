// @ts-check
const path = require("path");
const { getProjects, send } = require("../config");
const { listPrototypeComponents } = require("../services/prototype-components-list.service");
const { readComponentSource } = require("../services/design-component-source.service");

/** GET /api/project/:slug/design/prototypes/:protoId/components — componentes do DS usados pelo protótipo. */
async function apiPrototypeComponents({ res, params: [slug, protoId] }) {
  try {
    const data = listPrototypeComponents(path.join(getProjects(), slug), protoId);
    return send(res, 200, { ok: true, ...data });
  } catch (err) {
    return send(res, 404, { ok: false, error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/design/registry/:componentId/source — arquivos-fonte do componente. */
async function apiRegistryComponentSource({ res, params: [slug, componentId] }) {
  try {
    const source = readComponentSource(path.join(getProjects(), slug), componentId);
    return send(res, 200, { ok: true, source });
  } catch (err) {
    return send(res, 404, { ok: false, error: err.message || String(err) });
  }
}

module.exports = { apiPrototypeComponents, apiRegistryComponentSource };

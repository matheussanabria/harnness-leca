// @ts-check
// Skills and agents catalog grouped by area (GET list, POST manual area).
const netLib = require("../../../tools/lib/network");
const { send, readJsonBody } = require("../config");
const { buildCatalog } = require("../services/catalog/catalog-reader");
const { setOverride } = require("../services/catalog/catalog-overrides");

/** GET /api/catalog */
async function apiCatalogGet({ req, res }) {
  const local = !req || netLib.isLocalhostRequest(req);
  return send(res, 200, { ...buildCatalog(), canManage: local });
}

/** POST /api/catalog/area  body: { kind, name, area }  (area null clears the manual choice) */
async function apiCatalogAreaSet({ req, res }) {
  if (!netLib.isLocalhostRequest(req)) {
    return send(res, 403, { error: "Areas can only be changed on the local computer." });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { error: "Invalid JSON." });
  }
  try {
    setOverride(String(body.kind || ""), String(body.name || ""), body.area ? String(body.area) : null);
  } catch (err) {
    return send(res, 400, { error: err.message });
  }
  return send(res, 200, { ...buildCatalog(), canManage: true });
}

module.exports = { apiCatalogGet, apiCatalogAreaSet };

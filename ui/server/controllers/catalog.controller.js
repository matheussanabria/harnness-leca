// @ts-check
// Skills and agents catalog grouped by area (GET list, POST manual area).
const netLib = require("../../../tools/lib/network");
const { send, readJsonBody } = require("../config");
const { buildCatalog } = require("../services/catalog/catalog-reader");
const { setOverride } = require("../services/catalog/catalog-overrides");
const { listTree, readItemFile } = require("../services/catalog/catalog-files");

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

/** GET /api/catalog/tree?kind=&source=&ref=  (read-only; remote requests already passed the PIN gate in the router) */
async function apiCatalogTree({ req, res, url }) {
  const q = url.searchParams;
  const tree = listTree(q.get("kind") || "", q.get("source") || "", q.get("ref") || "");
  if (!tree) return send(res, 404, { error: "Item not found." });
  return send(res, 200, tree);
}

/** GET /api/catalog/file?kind=&source=&ref=&path= */
async function apiCatalogFile({ req, res, url }) {
  const q = url.searchParams;
  const out = readItemFile(q.get("kind") || "", q.get("source") || "", q.get("ref") || "", q.get("path") || "");
  const { status, ...body } = out;
  return send(res, status, body);
}

module.exports = { apiCatalogGet, apiCatalogAreaSet, apiCatalogTree, apiCatalogFile };

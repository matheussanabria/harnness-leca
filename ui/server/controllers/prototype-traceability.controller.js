// @ts-check
const path = require("path");
const { getProjects, send } = require("../config");
const { resolveNodeTraceability } = require("../services/prototype-traceability.service");

/** GET /api/project/:slug/design/prototypes/:protoId/traceability?screenId=&nodeId= */
async function apiPrototypeTraceability({ res, params: [slug, protoId], url }) {
  const nodeId = url.searchParams.get("nodeId") || "";
  if (!nodeId) {
    return send(res, 400, { error: "Parâmetro nodeId é obrigatório." });
  }
  const screenId = url.searchParams.get("screenId") || "";
  const projectDir = path.join(getProjects(), slug);

  try {
    const traceability = resolveNodeTraceability(projectDir, protoId, screenId, nodeId);
    return send(res, 200, { ok: true, traceability });
  } catch (err) {
    return send(res, 404, { error: err.message || String(err) });
  }
}

module.exports = {
  apiPrototypeTraceability,
};

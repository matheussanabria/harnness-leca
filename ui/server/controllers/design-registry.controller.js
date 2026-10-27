// @ts-check
const path = require("path");
const { getProjects, send } = require("../config");
const {
  loadRegistry,
  getComponent,
  listRegistryComponents,
} = require("../services/design-registry.service");
const { extractAnnotationListPilot } = require("../services/design-extractor.service");
const { renderComponentPreview } = require("../services/design-preview.service");

/**
 * GET /api/project/:slug/design/registry
 */
async function apiRegistryList({ req, res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  const url = new URL(req.url, "http://localhost");
  const category = url.searchParams.get("category") || undefined;
  const framework = url.searchParams.get("framework") || undefined;

  const components = listRegistryComponents(projectDir, { category, framework });
  return send(res, 200, { ok: true, total: components.length, components });
}

/**
 * GET /api/project/:slug/design/registry/:componentId
 */
async function apiRegistryGetComponent({ res, params: [slug, componentId] }) {
  const projectDir = path.join(getProjects(), slug);
  const comp = getComponent(projectDir, componentId);
  if (!comp) {
    return send(res, 404, { ok: false, error: `Componente '${componentId}' não encontrado no Registry.` });
  }
  return send(res, 200, { ok: true, component: comp });
}

/**
 * GET /api/project/:slug/design/registry/:componentId/preview
 */
async function apiRegistryPreviewComponent({ req, res, params: [slug, componentId] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const component = getComponent(projectDir, componentId);
    const documentation = component?.documentation;
    const safeId = /^[a-z0-9_-]{1,100}$/i;
    if (safeId.test(documentation?.prototypeId || "") && safeId.test(documentation?.screenId || "")) {
      const location = `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(documentation.prototypeId)}/render/${encodeURIComponent(documentation.screenId)}`;
      res.writeHead(302, { Location: location, "X-Content-Type-Options": "nosniff" });
      return res.end();
    }
    const url = new URL(req.url, "http://localhost");
    let customProps = {};
    const propsParam = url.searchParams.get("props");
    if (propsParam) {
      try {
        customProps = JSON.parse(propsParam);
      } catch (e) {
        // Ignora JSON inválido nas props customizadas
      }
    }
    const html = renderComponentPreview(projectDir, componentId, customProps);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(html, "utf8"),
      "X-Content-Type-Options": "nosniff",
    });
    res.end(html);
  } catch (err) {
    return send(res, 404, { ok: false, error: err.message || String(err) });
  }
}

/**
 * POST /api/project/:slug/design/registry/extract-pilot
 */
async function apiRegistryExtractPilot({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const manifest = extractAnnotationListPilot(projectDir);
    return send(res, 200, { ok: true, message: "Piloto AnnotationList extraído com sucesso.", manifest });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message || String(err) });
  }
}

module.exports = {
  apiRegistryList,
  apiRegistryGetComponent,
  apiRegistryPreviewComponent,
  apiRegistryExtractPilot,
};

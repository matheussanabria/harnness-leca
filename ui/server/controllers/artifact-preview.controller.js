// @ts-check
const fs = require("fs");
const path = require("path");
const netLib = require("../../../tools/lib/network");
const { getProjects, send } = require("../config");
const { buildArtifactPreview, readArtifactPreviewRaw } = require("../services/artifact-preview.service");

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/i;
const RAW_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";

function rawUrl(slug, kind, file) {
  const params = new URLSearchParams({ kind, file, raw: "1" });
  return `/api/project/${encodeURIComponent(slug)}/artifacts/preview?${params.toString()}`;
}

function sendRaw(res, result) {
  res.writeHead(200, {
    "Content-Type": result.mime,
    "Content-Length": result.body.length,
    "Content-Disposition": "inline",
    "Content-Security-Policy": RAW_CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  return res.end(result.body);
}

/** GET /api/project/:slug/artifacts/preview?kind&file[&raw=1] */
async function apiProjectArtifactsPreview({ req, res, params: [slug] }) {
  if (!SLUG.test(String(slug || ""))) {
    return send(res, 400, { error: "Identificador de projeto inválido." });
  }
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  }

  const url = new URL(req.url, "http://x");
  const input = {
    kind: url.searchParams.get("kind") || "",
    file: url.searchParams.get("file") || "",
    includeLocal: !req || netLib.isLocalhostRequest(req),
  };
  try {
    if (url.searchParams.get("raw") === "1") {
      return sendRaw(res, readArtifactPreviewRaw(projectDir, input));
    }
    const payload = buildArtifactPreview(projectDir, input);
    if (["html", "image", "pdf"].includes(payload.previewKind)) {
      payload.url = rawUrl(slug, input.kind, payload.file);
    }
    return send(res, 200, payload);
  } catch (err) {
    // @ts-ignore
    const status = Number(err?.status) || 500;
    const message = status >= 500 ? "Falha ao gerar a prévia do artefato." : err.message;
    return send(res, status, { error: message });
  }
}

module.exports = { apiProjectArtifactsPreview };

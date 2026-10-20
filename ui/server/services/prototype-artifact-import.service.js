// @ts-check
const fs = require("fs");
const path = require("path");
const { initPrototype, getPrototypesBaseDir } = require("./prototype-storage.service");
const { sanitizeHtmlFragment, injectDataPidAttributes } = require("./prototype-sanitizer.service");

function artifactInspectionId(artifactId) {
  return `${artifactId}-inspecao`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function getBody(html) {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  return match ? match[1] : html;
}

function getHeadResources(html, assetBaseUrl) {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html)?.[1] || "";
  const resources = head.match(/<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["'][^"']+["'][^>]*>(?:<\/script\s*>)?/gi) || [];
  const links = resources.map((tag) => tag.replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/i, (full, attr, quote, value) => {
    if (/^(?:https?:|\/\/|data:|javascript:)/i.test(value)) return "";
    const relative = value.replace(/^\.\//, "");
    return `${attr}=${quote}${assetBaseUrl}/${relative}${quote}`;
  })).filter(Boolean);
  const styles = head.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || [];
  return [...styles, ...links].join("\n");
}

function prepareEditableBody(html) {
  return html.split(/(<script\b[\s\S]*?<\/script\s*>)/gi).map((part) => {
    if (/^<script\b/i.test(part)) return part;
    return injectDataPidAttributes(sanitizeHtmlFragment(part));
  }).join("");
}

/**
 * Cria uma cópia editável de um artefato estático sem alterar o arquivo de origem.
 * @param {string} projectDir
 * @param {string} slug
 * @param {{id: string, title?: string, file: string}} artifact
 */
function importArtifactForInspection(projectDir, slug, artifact) {
  if (!artifact?.id || !artifact?.file) throw new Error("Artefato inválido para inspeção.");
  const protoId = artifactInspectionId(artifact.id);
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);

  const sourceFile = path.resolve(projectDir, artifact.file);
  const designDir = path.resolve(projectDir, "design");
  const relative = path.relative(designDir, sourceFile);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(sourceFile)) {
    throw new Error("Arquivo do artefato não encontrado no projeto.");
  }
  const sourceHtml = fs.readFileSync(sourceFile, "utf8");
  const assetBaseUrl = `/api/project/${encodeURIComponent(slug)}/design/prototype/${encodeURIComponent(artifact.id)}`;
  const title = `Inspeção — ${artifact.title || artifact.id}`;
  const existing = fs.existsSync(protoDir);
  let existingData = {};
  if (existing) {
    try { existingData = JSON.parse(fs.readFileSync(path.join(protoDir, "proto.json"), "utf8")); } catch {}
    if (existingData.metadata?.inspectionFormat >= 2) return { ok: true, created: false, protoId };
  }
  const proto = existing ? existingData : initPrototype(projectDir, protoId, title, { engine: "artifact-inspection", author: "user" });
  const safeBody = prepareEditableBody(getBody(sourceHtml));
  const headResources = getHeadResources(sourceHtml, assetBaseUrl);

  fs.writeFileSync(path.join(protoDir, "screens", "home.html"), safeBody, "utf8");
  fs.writeFileSync(path.join(protoDir, "head.html"), headResources, "utf8");
  fs.writeFileSync(path.join(protoDir, "styles", "proto.css"), "/* Estilos preservados do artefato de origem via head.html */\n", "utf8");

  const protoFile = path.join(protoDir, "proto.json");
  const data = JSON.parse(fs.readFileSync(protoFile, "utf8"));
  data.metadata = {
    ...data.metadata,
    sourceArtifact: artifact.id,
    sourceFile: artifact.file,
    inspectionCopy: true,
    inspectionFormat: 2,
  };
  fs.writeFileSync(protoFile, JSON.stringify(data, null, 2), "utf8");
  return { ok: true, created: !existing, migrated: existing, protoId, prototype: proto };
}

module.exports = { artifactInspectionId, getBody, getHeadResources, prepareEditableBody, importArtifactForInspection };

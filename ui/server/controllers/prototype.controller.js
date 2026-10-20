// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send, postOk } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { getProjectDesignContext } = require("../services/project-design-context.service");
const {
  initPrototype,
  savePrototypeFiles,
  listProjectPrototypes,
  getPrototypesBaseDir,
  normalizePrototypeManifest,
} = require("../services/prototype-storage.service");
const { renderPrototypeScreen } = require("../services/prototype-renderer.service");
const {
  listPrototypeVersions,
  restorePrototypeVersion,
} = require("../services/prototype-version.service");
const { parseDelimitedFiles } = require("../services/prototype-sanitizer.service");
const { buildDesignIndex } = require("../services/design-index.service");
const { importArtifactForInspection } = require("../services/prototype-artifact-import.service");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) reject(new Error("Corpo excede o limite."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("JSON inválido no corpo."));
      }
    });
    req.on("error", reject);
  });
}

/** GET /api/project/:slug/design/prototypes */
async function apiPrototypesList({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const list = listProjectPrototypes(projectDir);
  return send(res, 200, { ok: true, prototypes: list });
}

/** POST /api/project/:slug/design/prototypes */
async function apiPrototypesCreate({ req, res, params: [slug] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });

  try {
    const body = await readJsonBody(req);
    const protoId = (body.id || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (!protoId) return send(res, 400, { error: "ID do protótipo é obrigatório." });
    const proto = initPrototype(projectDir, protoId, body.title || protoId, {
      engine: body.engine || "manual",
      author: body.author || "user",
    });
    return send(res, 201, { ok: true, prototype: proto });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/import-artifact/:artifactId */
async function apiPrototypesImportArtifact({ req, res, params: [slug, artifactId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatÃ³rio." });
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' nÃ£o encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  const index = buildDesignIndex(projectDir, repo || projectDir, { profile: context.profile });
  const artifact = index.prototypes?.find((item) => item.id === artifactId && item.file);
  if (!artifact) return send(res, 404, { error: "Artefato do projeto nÃ£o encontrado." });

  try {
    return send(res, 201, importArtifactForInspection(projectDir, slug, artifact));
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/design/prototypes/:protoId */
async function apiPrototypesGet({ res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);
  if (!fs.existsSync(protoDir)) return send(res, 404, { error: `Protótipo '${protoId}' não encontrado.` });

  let protoJson = {};
  let mapaMd = "";
  try {
    const raw = fs.readFileSync(path.join(protoDir, "proto.json"), "utf8");
    protoJson = normalizePrototypeManifest(JSON.parse(raw), protoId);
  } catch {}
  try {
    mapaMd = fs.readFileSync(path.join(protoDir, "MAPA.md"), "utf8");
  } catch {}

  /** @type {Record<string,string>} */
  const files = {};
  for (const s of protoJson.screens || []) {
    try { files[s.file] = fs.readFileSync(path.join(protoDir, s.file), "utf8"); } catch {}
  }
  try { files["styles/proto.css"] = fs.readFileSync(path.join(protoDir, "styles", "proto.css"), "utf8"); } catch {}

  return send(res, 200, { ok: true, prototype: protoJson, mapa: mapaMd, files });
}

/** GET /api/project/:slug/design/prototypes/:protoId/render/:screenId? */
async function apiPrototypesRender({ res, params: [slug, protoId, screenId] }) {
  const projectDir = path.join(getProjects(), slug);
  const { repo } = getProjectRepoInfo(slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);

  const result = renderPrototypeScreen(projectDir, repo || projectDir, protoId, screenId || "home", context);
  if (!result.ok) {
    return send(res, result.status || 400, { error: result.error });
  }

  for (const [k, v] of Object.entries(result.headers)) {
    res.setHeader(k, v);
  }
  res.writeHead(result.status);
  return res.end(result.html);
}

/** POST /api/project/:slug/design/prototypes/:protoId/files */
async function apiPrototypesSaveFiles({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);

  try {
    const body = await readJsonBody(req);
    let files = [];
    if (Array.isArray(body.files)) {
      files = body.files;
    } else if (body.rawResponse && typeof body.rawResponse === "string") {
      files = parseDelimitedFiles(body.rawResponse);
    }

    if (files.length === 0) {
      return send(res, 400, { error: "Nenhum arquivo válido encontrado para gravar." });
    }

    const result = savePrototypeFiles(projectDir, protoId, files, {
      engine: body.engine || "chat",
      author: body.author || "user",
      message: body.message || "Atualização via Ateliê",
    });

    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/design/prototypes/:protoId/versions */
async function apiPrototypesVersionsGet({ res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);
  if (!fs.existsSync(protoDir)) return send(res, 404, { error: `Protótipo '${protoId}' não encontrado.` });

  const versions = listPrototypeVersions(protoDir);
  return send(res, 200, { ok: true, versions });
}

/** POST /api/project/:slug/design/prototypes/:protoId/versions/:ver/restore */
async function apiPrototypesVersionRestore({ req, res, params: [slug, protoId, verStr] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  const protoDir = path.join(getPrototypesBaseDir(projectDir), protoId);
  const targetVer = parseInt(verStr, 10);

  if (isNaN(targetVer) || targetVer < 1) {
    return send(res, 400, { error: "Número de versão inválido." });
  }

  const result = restorePrototypeVersion(protoDir, targetVer);
  if (!result.ok) return send(res, 400, { error: result.error });
  return send(res, 200, { ok: true, message: `Versão v${targetVer} restaurada com sucesso.` });
}

/** POST /api/project/:slug/design/prototypes/:protoId/edit/preview */
async function apiPrototypesEditPreview({ req, res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  try {
    const body = await readJsonBody(req);
    const { previewPrototypeEdit } = require("../services/prototype-editor.service");
    const result = previewPrototypeEdit(projectDir, protoId, body.screen, body.pid, body.op);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/edit/apply */
async function apiPrototypesEditApply({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  try {
    const body = await readJsonBody(req);
    const { applyPrototypeEdit } = require("../services/prototype-editor.service");
    const result = applyPrototypeEdit(projectDir, protoId, body.screen, body.pid, body.op, body.fingerprint);
    if (!result.ok) {
      const statusCode = result.conflict ? 409 : 400;
      return send(res, statusCode, { error: result.error });
    }
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/edit/undo */
async function apiPrototypesEditUndo({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  try {
    const body = await readJsonBody(req);
    const { undoPrototypeEdit } = require("../services/prototype-editor.service");
    const result = undoPrototypeEdit(projectDir, protoId, body.screen);
    if (!result.ok) return send(res, 400, { error: result.error });
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/edit/structural */
async function apiPrototypesEditStructural({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  try {
    const body = await readJsonBody(req);
    const screenFile = path.join(getPrototypesBaseDir(projectDir), protoId, "screens", `${body.screen || "home"}.html`);
    if (!fs.existsSync(screenFile)) return send(res, 404, { error: "Tela não encontrada." });
    const { mutateStructuralHtml } = require("../services/prototype-structural.service");
    const currentHtml = fs.readFileSync(screenFile, "utf8");
    const mutated = mutateStructuralHtml(currentHtml, body.pid, body.op, body.snippetHtml);
    const tmp = `${screenFile}.tmp-${Date.now()}`;
    fs.writeFileSync(tmp, mutated, "utf8");
    fs.renameSync(tmp, screenFile);
    return send(res, 200, { ok: true });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** POST /api/project/:slug/design/prototypes/:protoId/extract-component */
async function apiPrototypesExtractComponent({ req, res, params: [slug, protoId] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  try {
    const body = await readJsonBody(req);
    const { extractComponentCandidate } = require("../services/prototype-structural.service");
    const result = extractComponentCandidate(projectDir, protoId, body.candidate || body);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

/** GET /api/project/:slug/design/prototypes/:protoId/export/single-html */
async function apiPrototypesExportSingleHtml({ res, params: [slug, protoId] }) {
  const projectDir = path.join(getProjects(), slug);
  const { repo } = getProjectRepoInfo(slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  try {
    const { compileSingleHtmlPrototype } = require("../services/prototype-exporter.service");
    const html = compileSingleHtmlPrototype(projectDir, repo || projectDir, protoId, context);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${protoId}.html"`);
    res.writeHead(200);
    return res.end(html);
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

module.exports = {
  apiPrototypesList,
  apiPrototypesCreate,
  apiPrototypesImportArtifact,
  apiPrototypesGet,
  apiPrototypesRender,
  apiPrototypesSaveFiles,
  apiPrototypesVersionsGet,
  apiPrototypesVersionRestore,
  apiPrototypesEditPreview,
  apiPrototypesEditApply,
  apiPrototypesEditUndo,
  apiPrototypesEditStructural,
  apiPrototypesExtractComponent,
  apiPrototypesExportSingleHtml,
};

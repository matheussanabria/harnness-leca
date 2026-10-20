// @ts-check
const fs = require("fs");
const path = require("path");
const { getProjects, send, postOk } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { buildDesignIndex } = require("../services/design-index.service");
const { getFeatureLayers, isInside, ALLOWED_DOC_EXTS, MAX_DOC_SIZE } = require("../services/design-layers.service");
const { getProjectScreens } = require("../services/project-screens.service");
const { getProjectAudit } = require("../services/project-audit.service");
const { getProjectDesignContext, invalidateProjectDesignContext } = require("../services/project-design-context.service");
const { detectProjectProfile } = require("../services/design-profile-detector.service");
const { resolvePrototypeArtifact } = require("../services/prototype-artifact.service");

const MAX_PROTOTYPE_SIZE = 15 * 1024 * 1024; // 15 MB

const PROTO_MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) reject(new Error("Corpo excede o limite."));
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

async function apiProjectDesignProfileGet({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  return send(res, 200, { ok: true, profile: context.profile, allowedRepoDirs: context.allowedRepoDirs });
}

async function apiProjectDesignProfileDetect({ res, params: [slug] }) {
  const { repo } = getProjectRepoInfo(slug);
  const projectDir = path.join(getProjects(), slug);
  const proposal = detectProjectProfile(repo || projectDir);
  return send(res, 200, { ok: true, proposal });
}

async function apiProjectDesignProfileSave({ req, res, params: [slug] }) {
  if (!postOk(req)) return send(res, 403, { error: "Acesso negado: PIN ou localhost obrigatório." });
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });

  try {
    const body = await readJsonBody(req);
    const profile = body.profile || body;
    if (!profile || profile.schema !== 1) {
      return send(res, 400, { error: "Perfil inválido: schema 1 obrigatório." });
    }
    const designDir = path.join(projectDir, "design");
    if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
    const profilePath = path.join(designDir, "profile.json");
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf8");
    invalidateProjectDesignContext(slug);
    return send(res, 200, { ok: true, message: "Perfil de design salvo com sucesso." });
  } catch (err) {
    return send(res, 400, { error: err.message || String(err) });
  }
}

async function apiProjectDesignIndex({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo, cwd } = getProjectRepoInfo(slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  const result = buildDesignIndex(projectDir, repo || projectDir, { appCwd: cwd, profile: context.profile });
  if (!result.ok) return send(res, 400, { error: result.error });
  return send(res, 200, result);
}

async function apiProjectDesignLayers({ req, res, params: [slug] }) {
  const url = new URL(req.url, "http://x");
  const featureSlug = url.searchParams.get("feature");
  if (!featureSlug) return send(res, 400, { error: "Parâmetro 'feature' é obrigatório." });
  const { repo } = getProjectRepoInfo(slug);
  const projectDir = path.join(getProjects(), slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  const result = getFeatureLayers(repo || projectDir, featureSlug, { fs, path }, context.profile.docs);
  if (!result.found) return send(res, 404, { error: result.error || "Funcionalidade não encontrada." });
  return send(res, 200, result);
}

async function apiProjectDesignFile({ req, res, params: [slug] }) {
  const url = new URL(req.url, "http://x");
  const relPath = url.searchParams.get("path");
  const source = url.searchParams.get("source") || "repo";
  if (!relPath || relPath.includes("\0") || relPath.includes("..")) {
    return send(res, 400, { error: "Caminho de arquivo inválido ou proibido." });
  }
  const ext = path.extname(relPath).toLowerCase();
  if (!ALLOWED_DOC_EXTS.has(ext)) return send(res, 403, { error: `Extensão '${ext}' não permitida.` });

  let rootDir = "";
  if (source === "design") {
    rootDir = path.join(getProjects(), slug, "design");
  } else {
    const { repo } = getProjectRepoInfo(slug);
    const projectDir = path.join(getProjects(), slug);
    const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
    rootDir = repo || projectDir;
    const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const isAllowed = context.allowedRepoDirs.some((d) => normalized.startsWith(d));
    if (!isAllowed) return send(res, 403, { error: "Acesso negado: pasta não permitida pelo perfil de design." });
  }

  const targetFile = path.resolve(rootDir, relPath);
  if (!isInside(rootDir, targetFile) || !fs.existsSync(targetFile)) return send(res, 404, { error: "Arquivo não encontrado." });
  const st = fs.statSync(targetFile);
  if (!st.isFile()) return send(res, 400, { error: "Não é um arquivo comum." });
  if (st.size > MAX_DOC_SIZE) return send(res, 413, { error: "Arquivo excede limite permitido." });
  return send(res, 200, { path: relPath.replace(/\\/g, "/"), size: st.size, content: fs.readFileSync(targetFile, "utf8") });
}

async function apiProjectDesignPrototype({ req, res, params: [slug, pathProtoId, rawSubpath] }) {
  const url = new URL(req.url, "http://x");
  const protoId = pathProtoId || url.searchParams.get("id");
  if (!protoId || !/^[a-z0-9_-]{1,80}$/i.test(protoId)) return send(res, 400, { error: "Protótipo inválido." });

  if (!pathProtoId && url.searchParams.has("id")) {
    res.writeHead(302, { Location: `/api/project/${encodeURIComponent(slug)}/design/prototype/${encodeURIComponent(protoId)}/` });
    return res.end();
  }

  const { repo } = getProjectRepoInfo(slug);
  const projectDir = path.join(getProjects(), slug);
  const context = getProjectDesignContext(slug, projectDir, repo || projectDir);
  const designData = buildDesignIndex(projectDir, repo || projectDir, { profile: context.profile });
  const proto = (designData.prototypes || []).find((p) => p.id === protoId);
  if (!proto || !proto.file) return send(res, 404, { error: `Protótipo '${protoId}' não encontrado.` });

  const artifact = resolvePrototypeArtifact(projectDir, proto, rawSubpath || "");
  if (!artifact.ok) return send(res, artifact.status || 400, { error: artifact.error });
  if (artifact.size > MAX_PROTOTYPE_SIZE) return send(res, 413, { error: "Arquivo excede o limite." });
  const ext = path.extname(artifact.file).toLowerCase();
  res.setHeader("Content-Type", PROTO_MIME[ext] || "application/octet-stream");
  res.setHeader("Content-Security-Policy", "sandbox allow-scripts");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.writeHead(200);
  return res.end(fs.readFileSync(artifact.file));
}

async function apiProjectDesignScreens({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  return send(res, 200, getProjectScreens(slug, repo || projectDir, projectDir));
}

async function apiProjectDesignAudit({ res, params: [slug] }) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return send(res, 404, { error: `Projeto '${slug}' não encontrado.` });
  const { repo } = getProjectRepoInfo(slug);
  return send(res, 200, getProjectAudit(slug, repo || projectDir, projectDir));
}

module.exports = {
  apiProjectDesignProfileGet,
  apiProjectDesignProfileDetect,
  apiProjectDesignProfileSave,
  apiProjectDesignIndex,
  apiProjectDesignLayers,
  apiProjectDesignFile,
  apiProjectDesignPrototype,
  apiProjectDesignScreens,
  apiProjectDesignAudit,
};

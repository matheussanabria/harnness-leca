// @ts-check
// Read-only documentation of a project repo (doc/) for the Layers map reader:
//   GET /api/project/:slug/docs/tree      filtered tree of doc/
//   GET /api/project/:slug/docs/catalog   panel sections (review, checklist, open issues, features, stories, drafts)
//   GET /api/project/:slug/docs/file?path=<relative to doc>   one file, confined to doc/
//   GET /api/project/:slug/docs/refs      reference index plus per-screen field stories and unresolved references
const fs = require("node:fs");
const path = require("node:path");
const { getProjects, send } = require("../config");
const { getProjectRepoInfo } = require("./inspect.controller");
const { getProjectScreens } = require("../services/project-screens.service");
const { readFieldLinks } = require("../services/story-field-links.service");
const { createDocAccess } = require("../services/project-docs/confine");
const { readDocTree } = require("../services/project-docs/tree");
const { getRefsIndex, screenRefs } = require("../services/project-docs/refs-index");
const { buildCatalog } = require("../services/project-docs/catalog");

/** @param {string} slug @returns {{ projectDir: string, repoRoot: string } | null} */
function locate(slug) {
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) return null;
  const { repo } = getProjectRepoInfo(slug);
  return { projectDir, repoRoot: repo || projectDir };
}

/** @param {string} slug */
function load(slug) {
  const where = locate(slug);
  if (!where) return null;
  const access = createDocAccess(where.repoRoot);
  return { ...where, access, listing: readDocTree(access) };
}

const notFound = (res, slug) => send(res, 404, { error: `Projeto '${slug}' não encontrado.` });

async function apiProjectDocsTree({ res, params: [slug] }) {
  const ctx = load(slug);
  if (!ctx) return notFound(res, slug);
  const { found, tree, truncated } = ctx.listing;
  return send(res, 200, { found, root: "doc", tree, truncated });
}

async function apiProjectDocsCatalog({ res, params: [slug] }) {
  const ctx = load(slug);
  if (!ctx) return notFound(res, slug);
  if (!ctx.listing.found) return send(res, 200, { found: false });
  const index = getRefsIndex(ctx.repoRoot, ctx.access, ctx.listing.files);
  return send(res, 200, { found: true, ...buildCatalog(ctx.listing.files, index) });
}

async function apiProjectDocsFile({ res, url, params: [slug] }) {
  const where = locate(slug);
  if (!where) return notFound(res, slug);
  const hit = createDocAccess(where.repoRoot).read(url.searchParams.get("path"));
  if (!hit.ok) return send(res, hit.status, { error: hit.error });
  return send(res, 200, { path: hit.rel, ext: path.extname(hit.rel).slice(1).toLowerCase(), text: hit.text, mtime: hit.mtime });
}

async function apiProjectDocsRefs({ res, params: [slug] }) {
  const ctx = load(slug);
  if (!ctx) return notFound(res, slug);
  if (!ctx.listing.found) return send(res, 200, { found: false });
  const index = getRefsIndex(ctx.repoRoot, ctx.access, ctx.listing.files);
  const screens = getProjectScreens(slug, ctx.repoRoot, ctx.projectDir).screens || [];
  const perScreen = screenRefs(index, screens, readFieldLinks(ctx.repoRoot, screens));
  return send(res, 200, { found: true, ...index, ...perScreen });
}

module.exports = { apiProjectDocsTree, apiProjectDocsCatalog, apiProjectDocsFile, apiProjectDocsRefs };

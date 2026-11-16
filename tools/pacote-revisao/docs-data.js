// @ts-check
// Documentation embedded in the static review package (phase 3 of the docs reader). Only what is inside the
// package folder (<pasta>/doc, curated by hand) is embedded, with the same confinement and secret rules as the
// Harness reader; the secret block comes from the PROJECT repo .gitignore, since the package folder has none.
// The reference index is built from the whole project doc/, so a reference to a document left out of the
// package shows "não incluído no pacote" instead of a broken link, and `check` can list those documents.
const path = require("path");
const { ROOT } = require("./config");
const services = path.join(ROOT, "ui", "server", "services");
const { createDocAccess } = require(path.join(services, "project-docs", "confine.js"));
const { createSecretFilter } = require(path.join(services, "project-docs", "secret-rules.js"));
const { readDocTree } = require(path.join(services, "project-docs", "tree.js"));
const { buildRefsIndex, screenRefs } = require(path.join(services, "project-docs", "refs-index.js"));
const { buildCatalog } = require(path.join(services, "project-docs", "catalog.js"));
const { readFieldLinks } = require(path.join(services, "story-field-links.service.js"));

/** @param {any[]} nodes @param {(p: string) => boolean} keep */
function pruneTree(nodes, keep) {
  /** @type {any[]} */
  const out = [];
  for (const n of nodes || []) {
    if (n.kind === "dir") {
      const children = pruneTree(n.children, keep);
      if (children.length) out.push({ ...n, children });
    } else if (keep(n.path)) out.push(n);
  }
  return out;
}

/**
 * Documents each screen of the map points to, as the strip and the chips resolve them:
 * rules (rn), field stories, the stories and the dossier documents of the screen's feature.
 * @param {any} index @param {any} perScreen @param {any[]} screens
 * @returns {Map<string, Set<string>>} document path -> references that cite it
 */
function citedDocuments(index, perScreen, screens) {
  /** @type {Map<string, Set<string>>} */
  const cited = new Map();
  const add = (p, ref) => {
    if (!p) return;
    if (!cited.has(p)) cited.set(p, new Set());
    /** @type {Set<string>} */ (cited.get(p)).add(ref);
  };
  const storyPath = (id) => (index.stories[id] || index.stories[index.aliases[id]] || {}).path;
  for (const sc of screens) {
    for (const rule of sc.rules || []) for (const id of rule.rn || []) add(index.rn[id] && index.rn[id].path, id);
    for (const slot of Object.values(perScreen.fieldStories[sc.id] || {})) {
      for (const id of [...slot.principal, ...slot.relacionadas]) add(storyPath(id), id);
    }
    const feature = sc.feature && index.features[sc.feature];
    if (!feature) continue;
    for (const s of feature.stories) add(storyPath(s.id), s.id);
    for (const kind of ["regras", "bdd", "testes", "rastreio"]) add(feature.docs[kind], `${sc.feature} (${kind})`);
  }
  return cited;
}

/**
 * The package folder may spell a path with other letter case than the repo (scrum/DIS-454 vs scrum/dis-454):
 * every path string of the index that matches a package file ignoring case becomes the package spelling.
 * @template T @param {T} value @param {Map<string, string>} byLower
 * @returns {T}
 */
function alignPaths(value, byLower) {
  if (typeof value === "string") return /** @type {any} */ (byLower.get(value.toLowerCase()) || value);
  if (Array.isArray(value)) return /** @type {any} */ (value.map((v) => alignPaths(v, byLower)));
  if (value && typeof value === "object") {
    return /** @type {any} */ (Object.fromEntries(Object.entries(value).map(([k, v]) => [k, alignPaths(v, byLower)])));
  }
  return value;
}

/**
 * @param {{ repo: string, outDir: string, screens: any[] }} p
 */
function collectDocs({ repo, outDir, screens }) {
  const repoAccess = createDocAccess(repo);
  const repoListing = readDocTree(repoAccess);
  const repoIndex = buildRefsIndex(repoAccess, repoListing.files);
  const perScreen = screenRefs(repoIndex, screens, readFieldLinks(repo, screens));

  const isSecret = createSecretFilter(repo);
  const pkgAccess = createDocAccess(outDir || path.join(repo, ".sem-pasta-de-pacote"));
  const pkgListing = readDocTree(pkgAccess);
  const keep = (p) => !isSecret(p);
  const pkgFiles = pkgListing.files.filter((f) => keep(f.path));
  /** @type {Record<string, string>} */
  const files = {};
  for (const f of pkgFiles) {
    const r = pkgAccess.read(f.path);
    if (r.ok) files[f.path] = r.text;
  }
  const included = Object.keys(files).sort();
  const byLower = new Map(included.map((p) => [p.toLowerCase(), p]));
  const index = alignPaths(repoIndex, byLower);
  const pkgIndex = buildRefsIndex(pkgAccess, pkgFiles);
  const cited = citedDocuments(index, perScreen, screens);
  const foraDoPacote = [...cited]
    .filter(([p]) => !files[p])
    .map(([p, refs]) => ({ path: p, refs: [...refs].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    data: {
      refs: { found: true, ...index, ...perScreen, included },
      catalog: { found: pkgListing.found, ...buildCatalog(pkgFiles, pkgIndex) },
      tree: { found: pkgListing.found, tree: pruneTree(pkgListing.tree, keep) },
      paths: alignPaths(repoListing.files.map((f) => f.path), byLower),
      files,
    },
    foraDoPacote,
    semDocumento: perScreen.missing,
  };
}

module.exports = { collectDocs, citedDocuments, pruneTree, alignPaths };

// @ts-check
// Reference index of a project's doc/: rules (RN), stories and their criteria, trace ids of rastreio.yml,
// features with their dossier documents, story -> owning feature, and placeholder aliases. Read only; it
// writes no data. Paths are relative to doc/. Cached per repo by the size and date of the files it reads.
const { parseStories, parseTitle } = require("../story-features.service");
const { parseRules, parseStory, parseTrace, parseAliases, frontmatterValue, rnAnchor, criterionAnchor } = require("./refs-parsers");

const FEATURES = "sistema/features/";
const REGISTRY = `${FEATURES}_historias.md`;
const STORY_DIR = /^scrum\/((?:[A-Z]+-\d+)|(?:[A-Z]+-NOVA-[A-Z0-9-]+))\/user-story\.md$/i;
/** Dossier documents by role; the first name found wins. */
const DOC_KINDS = {
  status: ["_status.md"],
  regras: ["regras.md"],
  bdd: ["02-bdd.md", "02-bdd.feature"],
  modelagem: ["04-modelagem.md"],
  testes: ["06-testes.md"],
  rastreio: ["rastreio.yml"],
  arquivos: ["arquivos.md"],
  mapa: ["mapa-camadas.json"],
};

/** @type {Map<string, { signature: string, index: any }>} */
const cache = new Map();

/** @param {string} p @returns {string | null} feature slug of a dossier file */
function featureOf(p) {
  if (!p.startsWith(FEATURES)) return null;
  const parts = p.slice(FEATURES.length).split("/");
  return parts.length === 2 && !parts[0].startsWith("_") ? parts[0] : null;
}

/** @param {{ path: string }[]} files */
function relevant(files) {
  return files.filter((f) => featureOf(f.path) || STORY_DIR.test(f.path) || f.path === REGISTRY);
}

/**
 * @param {{ read: (rel: string) => any }} access
 * @param {{ path: string, size: number, mtime: number }[]} files listable files from readDocTree
 */
function buildRefsIndex(access, files) {
  const read = (rel) => {
    const r = access.read(rel);
    return r.ok ? r.text : "";
  };
  /** @type {Record<string, any>} */ const rn = {};
  /** @type {Record<string, any>} */ const stories = {};
  /** @type {Record<string, any[]>} */ const trace = {};
  /** @type {Record<string, any>} */ const features = {};
  /** @type {Record<string, string[]>} */ const storyFeatures = {};

  /** @type {Map<string, string[]>} */
  const bySlug = new Map();
  for (const f of files) {
    const slug = featureOf(f.path);
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) || []), f.path]);
  }

  for (const [slug, paths] of [...bySlug].sort((a, b) => a[0].localeCompare(b[0]))) {
    const names = paths.map((p) => p.slice(FEATURES.length + slug.length + 1));
    /** @type {Record<string, string>} */
    const docs = {};
    for (const [kind, candidates] of Object.entries(DOC_KINDS)) {
      const hit = candidates.find((n) => names.includes(n));
      if (hit) docs[kind] = `${FEATURES}${slug}/${hit}`;
    }
    const known = new Set(Object.values(docs));
    const others = paths.filter((p) => !known.has(p) && p.endsWith(".md")).sort();
    const statusText = docs.status ? read(docs.status) : "";
    const links = statusText ? parseStories(statusText) : [];
    features[slug] = {
      title: statusText ? parseTitle(statusText, slug) : slug,
      status: frontmatterValue(statusText, "status"),
      docs,
      others,
      stories: links.map((l) => ({ id: l.key, role: l.papel })),
    };
    for (const l of links) {
      if (/^principal$/i.test(l.papel)) (storyFeatures[l.key] ||= []).push(slug);
    }
    if (docs.regras) {
      for (const r of parseRules(read(docs.regras))) {
        if (!rn[r.id]) rn[r.id] = { path: docs.regras, anchor: rnAnchor(r.id), line: r.line, text: r.text, feature: slug };
      }
    }
    if (docs.rastreio) {
      for (const t of parseTrace(read(docs.rastreio))) {
        (trace[t.id] ||= []).push({ path: docs.rastreio, line: t.line, title: t.title, feature: slug });
      }
    }
  }

  for (const f of files) {
    const m = f.path.match(STORY_DIR);
    if (!m) continue;
    const id = m[1].toUpperCase();
    const parsed = parseStory(read(f.path));
    /** @type {Record<string, any>} */
    const criteria = {};
    for (const [n, c] of Object.entries(parsed.criteria)) criteria[n] = { anchor: criterionAnchor(n), line: c.line, text: c.text };
    stories[id] = { path: f.path, title: parsed.title, draft: /-NOVA-/i.test(id), criteria };
  }

  const aliases = files.some((f) => f.path === REGISTRY) ? parseAliases(read(REGISTRY)) : {};
  for (const [from, to] of Object.entries(aliases)) {
    if (stories[from]) stories[from].aliasOf = to;
  }
  return { rn, stories, trace, features, storyFeatures, aliases };
}

/**
 * Cached index: rebuilt only when a file it reads changed size or date, or a file was added or removed.
 * @param {string} repoRoot cache key
 * @param {{ read: (rel: string) => any }} access
 * @param {{ path: string, size: number, mtime: number }[]} files
 */
function getRefsIndex(repoRoot, access, files) {
  const used = relevant(files);
  const signature = used.map((f) => `${f.path}:${f.size}:${Math.round(f.mtime)}`).join("|");
  const hit = cache.get(repoRoot);
  if (hit && hit.signature === signature) return hit.index;
  const index = buildRefsIndex(access, used);
  cache.set(repoRoot, { signature, index });
  return index;
}

/**
 * Per screen, the field -> stories table (from _historias-funcionalidades.json, already resolved to final screen
 * ids by readFieldLinks) and the references its rules cite that the index cannot resolve.
 * @param {any} index
 * @param {any[]} screens final screens of the layers map
 * @param {Record<string, { dona: any[], relacionada: any[] }>} fieldLinks readFieldLinks result
 */
function screenRefs(index, screens, fieldLinks) {
  /** @type {Record<string, Record<string, { principal: string[], relacionadas: string[] }>>} */
  const fieldStories = {};
  for (const [story, buckets] of Object.entries(fieldLinks || {})) {
    for (const [bucket, key] of [["dona", "principal"], ["relacionada", "relacionadas"]]) {
      for (const item of buckets[bucket] || []) {
        if (!item.screenId || !item.fieldId) continue;
        const slot = ((fieldStories[item.screenId] ||= {})[item.fieldId] ||= { principal: [], relacionadas: [] });
        if (!slot[key].includes(story)) slot[key].push(story);
      }
    }
  }
  /** @type {{ screen: string, kind: string, id: string }[]} */
  const missing = [];
  const knownStory = (id) => Boolean(index.stories[id] || index.aliases[id]);
  for (const sc of screens || []) {
    for (const rule of sc.rules || []) {
      for (const id of rule.rn || []) if (!index.rn[id]) missing.push({ screen: sc.id, kind: "rn", id });
    }
    for (const slot of Object.values(fieldStories[sc.id] || {})) {
      for (const id of [...slot.principal, ...slot.relacionadas]) {
        if (!knownStory(id) && !missing.some((m) => m.id === id && m.screen === sc.id)) missing.push({ screen: sc.id, kind: "story", id });
      }
    }
  }
  return { fieldStories, missing };
}

module.exports = { buildRefsIndex, getRefsIndex, screenRefs, featureOf, DOC_KINDS };

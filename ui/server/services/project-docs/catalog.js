// @ts-check
// Sections of the Documentation panel, built from the file list and the reference index (no extra reads):
// review index, checklist, open issues, features with their dossier, stories and drafts.

/** @param {string} p */
const base = (p) => p.split("/").pop() || p;
/** @param {string} p */
const isRoot = (p) => !p.includes("/");

/** Story ids sort by number, drafts by name. @param {string} a @param {string} b */
function byStoryId(a, b) {
  const na = Number((a.match(/-(\d+)$/) || [])[1]);
  const nb = Number((b.match(/-(\d+)$/) || [])[1]);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

/**
 * @param {{ path: string }[]} files listable files of doc/
 * @param {any} index buildRefsIndex result
 */
function buildCatalog(files, index) {
  const paths = files.map((f) => f.path);
  const md = paths.filter((p) => p.endsWith(".md"));
  const pick = (re) => md.filter((p) => re.test(base(p))).sort();

  const revisao = md.filter((p) => isRoot(p) && /^indice/i.test(base(p))).sort();
  const checklist = pick(/checklist/i);
  const pendencias = pick(/pend[eê]ncia/i);
  const used = new Set([...revisao, ...checklist, ...pendencias]);
  const inicio = md.filter((p) => isRoot(p) && !used.has(p)).sort();

  const funcionalidades = Object.entries(index.features || {}).map(([slug, f]) => ({
    slug,
    title: f.title,
    status: f.status,
    docs: f.docs,
    others: f.others,
    stories: f.stories,
  }));

  const stories = Object.entries(index.stories || {}).sort((a, b) => byStoryId(a[0], b[0]));
  const asItem = ([id, s]) => ({ id, title: s.title, path: s.path, aliasOf: s.aliasOf || null });
  return {
    revisao,
    checklist,
    pendencias,
    inicio,
    funcionalidades,
    historias: stories.filter(([, s]) => !s.draft).map(asItem),
    rascunhos: stories.filter(([, s]) => s.draft).map(asItem),
  };
}

module.exports = { buildCatalog };

// @ts-check
// Historia -> funcionalidades, lido de doc/sistema/features/<slug>/_status.md (campo "historias").
// Somente leitura. Cada funcionalidade traz as telas do Mapa em Camadas, para o link "Ver no mapa".
const fs = require("fs");
const path = require("path");
const { routeKey } = require("./project-screens-features");
const { readFieldLinks } = require("./story-field-links.service");

const KEY_RE = /^[A-Z]+-\d+$/;

/** Linhas de "historias:" do frontmatter: "DIS-443 principal" -> { key, papel }. */
function parseStories(text) {
  // `[^\r\n]*` e nao `.*`: em JS o `.` nao casa com `\r`, e com CRLF so a primeira linha era lida.
  const block = text.match(/^historias:[ \t]*\r?\n((?:[ \t]+- [^\r\n]*(?:\r?\n|$))+)/m);
  if (!block) return [];
  return block[1].split(/\r?\n/).map((line) => line.replace(/^\s*- /, "").trim()).filter(Boolean).map((line) => {
    const [key, ...rest] = line.split(/\s+/);
    return { key, papel: rest.join(" ") || "relacionada" };
  }).filter((item) => KEY_RE.test(item.key));
}

function parseTitle(text, slug) {
  const alias = text.match(/aliases:\s*\["([^"]+)"/);
  return alias ? alias[1].replace(/^Status:\s*/i, "") : slug;
}

/** Telas da funcionalidade no mapa: pelo id "<slug>-<tela>" ou, se a rota foi absorvida, pela rota. */
function screensOf(dir, slug, screens) {
  let telas = [];
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, "mapa-camadas.json"), "utf8"));
    telas = Array.isArray(data.telas) ? data.telas : [];
  } catch {
    return [];
  }
  const found = [];
  for (const tela of telas) {
    const own = screens.find((s) => s.id === `${slug}-${tela.id}`);
    const same = screens.find((s) => routeKey(s.route) && routeKey(s.route) === routeKey(tela.rota));
    const hit = own || same;
    if (hit && !found.some((f) => f.screenId === hit.id)) found.push({ screenId: hit.id, title: hit.title || tela.titulo });
  }
  return found;
}

/**
 * @param {string} repoRoot
 * @param {any[]} screens telas finais do Mapa em Camadas
 * @returns {{ found: boolean, stories: Record<string, { dona: any[], relacionada: any[] }> }}
 */
function readFeatureStories(repoRoot, screens) {
  const root = path.join(repoRoot, "doc", "sistema", "features");
  let dirs = [];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return { found: false, stories: {} };
  }
  /** @type {Record<string, { dona: any[], relacionada: any[] }>} */
  const stories = {};
  for (const slug of dirs) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(root, slug, "_status.md"), "utf8");
    } catch {
      continue;
    }
    const links = parseStories(text);
    if (!links.length) continue;
    const base = { slug, title: parseTitle(text, slug), screens: screensOf(path.join(root, slug), slug, screens) };
    for (const link of links) {
      const outras = links.filter((o) => o.key !== link.key);
      const bucket = (stories[link.key] ||= { dona: [], relacionada: [] });
      const target = /^principal$/i.test(link.papel) ? bucket.dona : bucket.relacionada;
      target.push({ ...base, papel: link.papel, outras });
    }
  }
  return { found: true, stories };
}

/**
 * Funcionalidades (por _status.md) e telas/campos (por _historias-funcionalidades.json) de cada historia.
 * @param {string} repoRoot
 * @param {any[]} screens
 * @returns {{ found: boolean, stories: Record<string, { dona: any[], relacionada: any[], campos: { dona: any[], relacionada: any[] } }> }}
 */
function readStoryFeatures(repoRoot, screens) {
  const base = readFeatureStories(repoRoot, screens);
  const fieldLinks = readFieldLinks(repoRoot, screens);
  /** @type {Record<string, any>} */
  const stories = {};
  for (const key of new Set([...Object.keys(base.stories), ...Object.keys(fieldLinks)])) {
    const features = base.stories[key] || { dona: [], relacionada: [] };
    stories[key] = { ...features, campos: fieldLinks[key] || { dona: [], relacionada: [] } };
  }
  return { found: base.found || Object.keys(fieldLinks).length > 0, stories };
}

module.exports = { readStoryFeatures, parseStories };

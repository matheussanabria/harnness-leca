// @ts-check
// Reads skills and agents from disk and builds the catalog grouped by area.
const fs = require("fs");
const path = require("path");
const { listSources } = require("./catalog-sources");
const cache = require("./catalog-cache");
const { classify, listAreas, loadAreas } = require("./catalog-areas");
const { readOverrides } = require("./catalog-overrides");

/** Default sources (user, harness and every project repo), kept briefly by the cache; tests pass their own. */
const defaultSources = () => cache.cachedSources(() => listSources());

const readMeta = cache.readMeta;

function listSkills(source) {
  if (!fs.existsSync(source.dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(source.dir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const file = path.join(source.dir, ent.name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const meta = readMeta(file);
    out.push({ kind: "skill", ref: ent.name, name: ent.name, description: meta.description || "", source: source.id, sourceLabel: source.label, scope: source.scope || "user", frontArea: meta.area || "" });
  }
  return out;
}

function listAgents(source) {
  if (!fs.existsSync(source.dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(source.dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
    const meta = readMeta(path.join(source.dir, ent.name));
    const name = meta.name || ent.name.replace(/\.md$/, "");
    out.push({ kind: "agent", ref: ent.name, name, description: meta.description || "", source: source.id, sourceLabel: source.label, scope: source.scope || "user", frontArea: meta.area || "", tools: meta.tools || "", model: meta.model || "" });
  }
  return out;
}

/**
 * Builds the catalog. An item listed by several sources appears once: the first source wins (order in
 * catalog-sources.js) and the others are listed in `alsoIn`.
 * Area precedence: `area:` in the item frontmatter, then the manual choice, then the keyword suggestion.
 * An area id that is not in the config (frontmatter or manual) is ignored.
 * @param {{ sources?: ReturnType<typeof defaultSources>, overridesFile?: string, areaConfig?: ReturnType<typeof loadAreas> }} [opts]
 */
function buildCatalog(opts = {}) {
  cache.beginPass();
  try {
    return build(opts);
  } finally {
    cache.endPass();
  }
}

function build(opts) {
  const sources = opts.sources || defaultSources();
  const overrides = readOverrides(opts.overridesFile);
  const config = opts.areaConfig || loadAreas();
  const areaList = listAreas(config);
  const known = (id) => (areaList.some((a) => a.id === id) ? id : "");
  const seen = new Map();
  const items = [];
  const all = [...sources.skills.flatMap(listSkills), ...sources.agents.flatMap(listAgents)];
  for (const item of all) {
    const key = `${item.kind}:${item.name}`;
    if (seen.has(key)) {
      seen.get(key).push(item.sourceLabel);
      continue;
    }
    const alsoIn = [];
    seen.set(key, alsoIn);
    const { frontArea, ...rest } = item;
    const suggested = classify(item.name, item.description, config);
    const fromFront = known(String(frontArea || "").trim().toLowerCase());
    const manual = known(overrides[key] || "");
    const areaSource = fromFront ? "frontmatter" : manual ? "manual" : "suggested";
    items.push({ ...rest, alsoIn, area: fromFront || manual || suggested, areaSource, suggestedArea: suggested, manual: areaSource === "manual" });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  const areas = areaList.map((a) => ({ ...a, count: items.filter((i) => i.area === a.id).length }));
  return { areas, items };
}

module.exports = { buildCatalog, defaultSources };

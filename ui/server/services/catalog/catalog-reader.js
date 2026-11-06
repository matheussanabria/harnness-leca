// @ts-check
// Reads skills and agents from disk and builds the catalog grouped by area.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT } = require("../../../../tools/lib/root");
const { cleanBOM, parseFrontmatter } = require("../../../../tools/lib/skills/frontmatter");
const { classify, listAreas } = require("./catalog-areas");
const { readOverrides } = require("./catalog-overrides");

/** Default sources; tests pass their own. */
function defaultSources() {
  const claude = path.join(os.homedir(), ".claude");
  return {
    skills: [
      { id: "user", label: "User (~/.claude)", dir: path.join(claude, "skills") },
      { id: "harness", label: "Harness (.agents)", dir: path.join(ROOT, ".agents", "skills") },
    ],
    agents: [{ id: "user", label: "User (~/.claude)", dir: path.join(claude, "agents") }],
  };
}

function readMeta(file) {
  try {
    return parseFrontmatter(cleanBOM(fs.readFileSync(file, "utf8"))).attributes;
  } catch {
    return {};
  }
}

function listSkills(source) {
  if (!fs.existsSync(source.dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(source.dir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const file = path.join(source.dir, ent.name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const meta = readMeta(file);
    out.push({ kind: "skill", ref: ent.name, name: ent.name, description: meta.description || "", source: source.id, sourceLabel: source.label });
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
    out.push({ kind: "agent", ref: ent.name, name, description: meta.description || "", source: source.id, sourceLabel: source.label, tools: meta.tools || "", model: meta.model || "" });
  }
  return out;
}

/**
 * Builds the catalog. An item listed by two sources appears once (first source wins).
 * @param {{ sources?: ReturnType<typeof defaultSources>, overridesFile?: string }} [opts]
 */
function buildCatalog(opts = {}) {
  const sources = opts.sources || defaultSources();
  const overrides = readOverrides(opts.overridesFile);
  const seen = new Set();
  const items = [];
  const all = [...sources.skills.flatMap(listSkills), ...sources.agents.flatMap(listAgents)];
  for (const item of all) {
    const key = `${item.kind}:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const suggested = classify(item.name, item.description);
    const manual = overrides[key] || null;
    items.push({ ...item, area: manual || suggested, suggestedArea: suggested, manual: !!manual });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  const areas = listAreas().map((a) => ({ ...a, count: items.filter((i) => i.area === a.id).length }));
  return { areas, items };
}

module.exports = { buildCatalog, defaultSources };

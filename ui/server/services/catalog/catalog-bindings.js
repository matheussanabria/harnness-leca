// @ts-check
// Links between catalog skills and Scrum lanes. The truth stays in skill-bindings.service (one manifest per
// project); this only reads those manifests and attaches the result to catalog items.
const fs = require("fs");
const path = require("path");
const { readBindingState } = require("../skill-bindings.service");

/**
 * Index skill name -> lanes that reference it, across every project folder.
 * @param {string} projectsDir
 * @param {Array<{id:string,name?:string}>} lanes
 * @returns {Map<string, Array<{project:string, laneId:string, laneName:string}>>}
 */
function bindingsBySkill(projectsDir, lanes) {
  const laneName = new Map(lanes.map((l) => [l.id, l.name || l.id]));
  const index = new Map();
  let slugs = [];
  try {
    slugs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith(".")).map((e) => e.name);
  } catch { /* no projects folder */ }
  for (const slug of slugs) {
    const dir = path.join(projectsDir, slug);
    if (!fs.existsSync(path.join(dir, "skill-bindings.json"))) continue;
    for (const [laneId, keys] of Object.entries(readBindingState(dir).items)) {
      for (const key of keys) {
        const name = key.slice(key.indexOf(":") + 1);
        if (!index.has(name)) index.set(name, []);
        index.get(name).push({ project: slug, laneId, laneName: laneName.get(laneId) || laneId });
      }
    }
  }
  return index;
}

/**
 * Adds `lanes` (links) and `orphan` to every skill. A skill is orphan only when it lives in a project
 * repo (so it could be bound) and no lane references it; user and harness skills are never orphans.
 */
function attachBindings(catalog, index) {
  const items = catalog.items.map((item) => {
    if (item.kind !== "skill") return item;
    const lanes = index.get(item.name) || [];
    return { ...item, lanes, orphan: item.scope === "project" && lanes.length === 0 };
  });
  return { ...catalog, items };
}

module.exports = { bindingsBySkill, attachBindings };

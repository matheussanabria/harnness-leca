const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { classify, listAreas } = require("../ui/server/services/catalog/catalog-areas");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");
const { setOverride, readOverrides } = require("../ui/server/services/catalog/catalog-overrides");

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
  const skills = path.join(dir, "skills");
  const agents = path.join(dir, "agents");
  fs.mkdirSync(path.join(skills, "technical-writing"), { recursive: true });
  fs.mkdirSync(path.join(skills, "angular18-expert"), { recursive: true });
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(skills, "technical-writing", "SKILL.md"), "---\nname: technical-writing\ndescription: README, guias e changelog.\n---\nbody");
  fs.writeFileSync(path.join(skills, "angular18-expert", "SKILL.md"), "---\nname: angular18-expert\ndescription: Componentes Angular.\n---\nbody");
  fs.writeFileSync(path.join(agents, "frontend-engineer.md"), "---\nname: frontend-engineer\ndescription: Especialista em frontend.\ntools: Read, Edit\n---\nbody");
  fs.writeFileSync(path.join(agents, "mystery.md"), "---\nname: mystery\ndescription: Algo sem palavra-chave.\n---\nbody");
  const sources = { skills: [{ id: "user", label: "User", dir: skills }], agents: [{ id: "user", label: "User", dir: agents }] };
  return { dir, sources, overridesFile: path.join(dir, "catalog-areas.json") };
}

test("classify suggests an area from name and description, else other", () => {
  assert.equal(classify("technical-writing", "README e changelog"), "documentation");
  assert.equal(classify("angular18-expert", "Componentes"), "frontend");
  assert.equal(classify("mystery", "Algo sem palavra-chave"), "other");
  assert.ok(listAreas().some((a) => a.id === "other"));
});

test("short keywords match whole words only", () => {
  assert.notEqual(classify("social", ""), "devops");
});

test("buildCatalog reads skills and agents and counts per area", () => {
  const f = fixture();
  const cat = buildCatalog({ sources: f.sources, overridesFile: f.overridesFile });
  assert.equal(cat.items.length, 4);
  assert.equal(cat.items.find((i) => i.name === "frontend-engineer").kind, "agent");
  assert.equal(cat.items.find((i) => i.name === "frontend-engineer").area, "frontend");
  assert.equal(cat.areas.find((a) => a.id === "frontend").count, 2);
});

test("manual override wins over the suggestion and can be cleared", () => {
  const f = fixture();
  setOverride("agent", "mystery", "security", f.overridesFile);
  let cat = buildCatalog({ sources: f.sources, overridesFile: f.overridesFile });
  const item = cat.items.find((i) => i.name === "mystery");
  assert.equal(item.area, "security");
  assert.equal(item.manual, true);
  assert.equal(item.suggestedArea, "other");
  setOverride("agent", "mystery", null, f.overridesFile);
  assert.deepEqual(readOverrides(f.overridesFile), {});
  cat = buildCatalog({ sources: f.sources, overridesFile: f.overridesFile });
  assert.equal(cat.items.find((i) => i.name === "mystery").area, "other");
});

test("setOverride rejects unknown areas and bad names", () => {
  const f = fixture();
  assert.throws(() => setOverride("skill", "x", "nope", f.overridesFile), /Unknown area/);
  assert.throws(() => setOverride("skill", "../evil", "frontend", f.overridesFile), /Invalid item/);
  assert.throws(() => setOverride("other", "x", "frontend", f.overridesFile), /Invalid item/);
});

test("page model filters by kind, area and text; view escapes and has no emoji", async () => {
  const base = path.join(__dirname, "..", "ui", "public", "js", "catalogo");
  const model = await import(pathToFileURL(path.join(base, "catalogo-model.js")).href);
  const view = await import(pathToFileURL(path.join(base, "catalogo-view.js")).href);
  const areas = listAreas();
  const items = [
    { kind: "skill", name: "a", description: "x", area: "frontend", sourceLabel: "U" },
    { kind: "agent", name: "<b>", description: "y", area: "frontend", sourceLabel: "U", manual: true },
    { kind: "skill", name: "c", description: "z", area: "backend", sourceLabel: "U" },
  ];
  assert.equal(model.filterItems(items, { kind: "agent" }).length, 1);
  assert.equal(model.filterItems(items, { area: "backend" }).length, 1);
  assert.equal(model.filterItems(items, { text: "Y" }).length, 1);
  assert.equal(model.groupByArea(items, areas).length, 2);
  assert.equal(model.areaCounts(items, { kind: "skill" }).frontend, 1);
  const html = view.renderGroups(model.groupByArea(items, areas), areas, true) + view.renderAreaChips(areas, { all: 3, frontend: 2 }, "all");
  assert.ok(html.includes("&lt;b&gt;") && !html.includes("<b>"));
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(html), "no emojis");
});

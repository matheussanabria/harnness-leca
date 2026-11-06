const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { loadAreas, validateConfig, classify, listAreas } = require("../ui/server/services/catalog/catalog-areas");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "catalog-areas-"));
const write = (file, data) => fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));

const OTHER = { id: "other", label: "Outros", icon: "fa-folder-open" };
const custom = (areas) => ({ other: OTHER, areas });
const AREA_X = { id: "x", label: "Area X", icon: "fa-star", keywords: ["zebra"] };

test("bundled default loads and keeps the original areas and keywords", () => {
  const cfg = loadAreas({ configFile: path.join(tmp(), "none.json") });
  assert.equal(cfg.source, "default");
  assert.deepEqual(cfg.areas.map((a) => a.id), ["documentation", "frontend", "backend", "quality", "security", "devops", "product", "architecture", "ai"]);
  assert.ok(cfg.areas.find((a) => a.id === "documentation").keywords.includes("readme"));
  assert.equal(listAreas(cfg).at(-1).id, "other");
});

test("a valid custom config replaces the default (new and renamed areas)", () => {
  const dir = tmp();
  const file = path.join(dir, "cfg.json");
  write(file, custom([AREA_X, { id: "frontend", label: "Telas", icon: "fa-display", keywords: ["angular"] }]));
  const cfg = loadAreas({ configFile: file });
  assert.equal(cfg.source, "custom");
  assert.equal(classify("zebra-tool", "", cfg), "x");
  assert.equal(classify("angular-expert", "", cfg), "frontend");
  assert.equal(listAreas(cfg).find((a) => a.id === "frontend").label, "Telas");
  assert.equal(classify("nothing-here", "", cfg), "other");
});

test("an invalid custom config is ignored and the default is used", () => {
  const dir = tmp();
  const cases = {
    notjson: "{ nope",
    empty: custom([]),
    dupId: custom([AREA_X, AREA_X]),
    badId: custom([{ ...AREA_X, id: "Bad Id" }]),
    otherReserved: custom([{ ...AREA_X, id: "other" }]),
    badIcon: custom([{ ...AREA_X, icon: "star" }]),
    badKeywords: custom([{ ...AREA_X, keywords: [1] }]),
    noOther: { areas: [AREA_X] },
  };
  for (const [name, data] of Object.entries(cases)) {
    const file = path.join(dir, `${name}.json`);
    write(file, data);
    assert.equal(loadAreas({ configFile: file }).source, "default", name);
  }
  assert.equal(validateConfig(null), null);
});

function fixture(frontArea) {
  const dir = tmp();
  const skills = path.join(dir, "skills");
  fs.mkdirSync(path.join(skills, "zebra-skill"), { recursive: true });
  const fm = frontArea === undefined ? "" : `area: ${frontArea}\n`;
  write(path.join(skills, "zebra-skill", "SKILL.md"), `---\nname: zebra-skill\ndescription: Plain skill.\n${fm}---\nbody`);
  const agents = path.join(dir, "agents");
  fs.mkdirSync(agents);
  write(path.join(agents, "zed.md"), `---\nname: zed\ndescription: Agent.\narea: security\n---\nbody`);
  const sources = { skills: [{ id: "user", label: "U", dir: skills }], agents: [{ id: "user", label: "U", dir: agents }] };
  const cfgFile = path.join(dir, "cfg.json");
  write(cfgFile, custom([AREA_X, { id: "security", label: "Seg", icon: "fa-shield-halved", keywords: [] }]));
  return { dir, sources, areaConfig: loadAreas({ configFile: cfgFile }), overridesFile: path.join(dir, "o.json") };
}
const find = (cat, name) => cat.items.find((i) => i.name === name);

test("precedence: frontmatter, then manual choice, then keyword suggestion", () => {
  const f = fixture("security");
  write(f.overridesFile, { "skill:zebra-skill": "x" });
  let item = find(buildCatalog(f), "zebra-skill");
  assert.equal(item.area, "security");
  assert.equal(item.areaSource, "frontmatter");
  assert.equal(item.manual, false);

  const g = fixture(undefined);
  write(g.overridesFile, { "skill:zebra-skill": "security" });
  item = find(buildCatalog(g), "zebra-skill");
  assert.equal(item.area, "security");
  assert.equal(item.areaSource, "manual");
  assert.equal(item.manual, true);

  const h = fixture(undefined);
  item = find(buildCatalog(h), "zebra-skill");
  assert.equal(item.area, "x");
  assert.equal(item.areaSource, "suggested");
});

test("an unknown frontmatter area is ignored and the item falls back", () => {
  const f = fixture("nonexistent");
  const item = find(buildCatalog(f), "zebra-skill");
  assert.equal(item.area, "x");
  assert.equal(item.areaSource, "suggested");
});

test("frontmatter works for agents, is case-insensitive, and counts follow the area", () => {
  const f = fixture("X");
  const cat = buildCatalog(f);
  assert.equal(find(cat, "zed").area, "security");
  assert.equal(find(cat, "zed").areaSource, "frontmatter");
  assert.equal(find(cat, "zebra-skill").area, "x");
  assert.equal(cat.areas.find((a) => a.id === "security").count, 1);
  assert.equal(cat.areas.find((a) => a.id === "x").count, 1);
});

test("a manual choice for an area that no longer exists is ignored (item stays visible)", () => {
  const f = fixture(undefined);
  fs.writeFileSync(f.overridesFile, JSON.stringify({ "skill:zebra-skill": "removed-area" }));
  const item = find(buildCatalog(f), "zebra-skill");
  assert.equal(item.area, "x");
  assert.equal(item.areaSource, "suggested");
  assert.ok(buildCatalog(f).areas.some((a) => a.id === item.area));
});

test("view shows the area origin and locks the selector for frontmatter areas", async () => {
  const view = await import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "catalogo", "catalogo-view.js")).href);
  const areas = [{ id: "x", label: "X", icon: "fa-star" }];
  const item = (areaSource) => ({ kind: "skill", name: "a", description: "d", area: "x", source: "user", ref: "a", sourceLabel: "U", areaSource });
  const html = (src) => view.renderGroups([{ area: areas[0], items: [item(src)] }], areas, true);
  assert.match(html("frontmatter"), /frontmatter<\/span>/);
  assert.match(html("frontmatter"), /<select[^>]*disabled/);
  assert.match(html("manual"), /manual<\/span>/);
  assert.doesNotMatch(html("manual"), /<select[^>]*disabled/);
  assert.match(html("suggested"), /sugerida<\/span>/);
  assert.match(view.renderGroups([{ area: areas[0], items: [{ ...item("x"), areaSource: undefined }] }], areas, true), /sugerida<\/span>/);
});

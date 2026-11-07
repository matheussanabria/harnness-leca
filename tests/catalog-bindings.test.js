const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { bindingsBySkill, attachBindings } = require("../ui/server/services/catalog/catalog-bindings");

const lanes = [{ id: "dev", name: "Desenvolvimento" }, { id: "qa", name: "Qualidade" }];

function projects() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-bind-"));
  const write = (slug, items) => {
    fs.mkdirSync(path.join(dir, slug), { recursive: true });
    fs.writeFileSync(path.join(dir, slug, "skill-bindings.json"), JSON.stringify({ version: 1, updatedAt: "2026-01-01T00:00:00Z", items }));
  };
  write("alpha", { dev: ["agents:linter", "claude:tdd"], qa: ["agents:linter"] });
  write("beta", { dev: ["agents:linter"] });
  fs.mkdirSync(path.join(dir, "gamma"));
  fs.mkdirSync(path.join(dir, "_template"));
  fs.writeFileSync(path.join(dir, "_template", "skill-bindings.json"), "{ not json");
  return dir;
}

test("index lists every project and lane that references a skill name", () => {
  const idx = bindingsBySkill(projects(), lanes);
  assert.deepEqual(idx.get("linter").map((l) => `${l.project}/${l.laneId}`).sort(), ["alpha/dev", "alpha/qa", "beta/dev"]);
  assert.equal(idx.get("linter")[0].laneName.length > 0, true);
  assert.equal(idx.get("tdd").length, 1);
  assert.equal(idx.has("missing"), false);
});

test("projects without manifest, template folders and a missing folder are ignored", () => {
  assert.equal(bindingsBySkill(projects(), lanes).size, 2);
  assert.equal(bindingsBySkill(path.join(os.tmpdir(), "no-such-dir-xyz"), lanes).size, 0);
});

test("a corrupt manifest does not break the index", () => {
  const dir = projects();
  fs.writeFileSync(path.join(dir, "beta", "skill-bindings.json"), "{ not json");
  const idx = bindingsBySkill(dir, lanes);
  assert.deepEqual(idx.get("linter").map((l) => l.project), ["alpha", "alpha"]);
});

test("project skills without a lane are orphans; user, harness and agents never are", () => {
  const catalog = { areas: [], items: [
    { kind: "skill", name: "linter", scope: "project" },
    { kind: "skill", name: "lonely", scope: "project" },
    { kind: "skill", name: "personal", scope: "user" },
    { kind: "skill", name: "tdd", scope: "harness" },
    { kind: "agent", name: "lonely", scope: "project" },
  ] };
  const out = attachBindings(catalog, bindingsBySkill(projects(), lanes)).items;
  const by = (k, n) => out.find((i) => i.kind === k && i.name === n);
  assert.equal(by("skill", "linter").orphan, false);
  assert.equal(by("skill", "linter").lanes.length, 3);
  assert.equal(by("skill", "lonely").orphan, true);
  assert.equal(by("skill", "personal").orphan, false);
  assert.equal(by("skill", "tdd").lanes.length, 1);
  assert.equal("lanes" in by("agent", "lonely"), false);
});

test("the card shows the lane count or the orphan warning, escaped", async () => {
  const { linkTag } = await import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "catalogo", "catalogo-view.js")).href);
  assert.match(linkTag({ orphan: true }), /sem vínculo/);
  assert.match(linkTag({ lanes: [{ project: "a", laneName: "Dev" }] }), /1 raia</);
  assert.match(linkTag({ lanes: [{ project: "a", laneName: "<b>x" }, { project: "b", laneName: "Qa" }] }), /2 raias/);
  assert.ok(!linkTag({ lanes: [{ project: "a", laneName: "<b>x" }] }).includes("<b>x"));
  assert.equal(linkTag({ lanes: [] }), "");
});

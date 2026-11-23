// Layers: dai < global < project by id, project.json disable, the layers CLI and the AGENTS.md section.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-layers-"));
process.env.HARNESS_ROOT = TMP;
const DAI = path.join(TMP, "dai");
const proj = path.join(TMP, "projects", "demo");
fs.mkdirSync(proj, { recursive: true });
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { resolveLayers } = require("../tools/lib/layers/resolve");
const { layersLines } = require("../tools/lib/layers/../export/layers-block");
const { planCodex } = require("../tools/lib/export/codex");
const layersCli = require("../tools/layers");

const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const skill = (root, id, desc) => put(path.join(root, id, "SKILL.md"), `---\nname: ${id}\ndescription: ${desc}\n---\n# ${id}\n`);
const find = (r, kind, id) => r.items.find((i) => i.kind === kind && i.id === id);

// DAI: a nested skill, two skills, an agent, a workflow and an architecture folder that must be ignored
skill(path.join(DAI, "skills", "qualidade"), "bug-reporting", "Reports bugs.");
skill(path.join(DAI, "skills", "git"), "commit", "DAI commit.");
skill(path.join(DAI, "skills", "00-skill-architecture"), "ignored", "x");
put(path.join(DAI, ".agents", "qa-engineer", "AGENT.md"), "# QA Engineer\n\nTests quality.\n");
put(path.join(DAI, ".agents", "00-agent-architecture", "x.md"), "x");
put(path.join(DAI, "workflows", "sprint-cycle", "manifest.yaml"), "id: sprint-cycle\ndescription: Sprint loop\n");
// global and project
skill(path.join(TMP, "global", "skills"), "commit", "Global commit.");
skill(path.join(proj, "skills"), "commit", "Project commit.");
skill(path.join(proj, "skills"), "only-here", "Project only.");
put(path.join(proj, "workflows", "release", "manifest.yaml"), "id: release\ndescription: Project release\n");

test("the most specific layer wins by id and reports what it replaced", () => {
  const r = resolveLayers("demo", { daiPath: DAI });
  const c = find(r, "skill", "commit");
  assert.equal(c.layer, "project");
  assert.equal(c.description, "Project commit.");
  assert.deepEqual(c.overrides, ["dai", "global"]);
  assert.equal(find(r, "skill", "bug-reporting").layer, "dai", "nested DAI skill is found");
  assert.equal(find(r, "skill", "only-here").layer, "project");
});

test("agents and workflows are scanned; 00- architecture folders are skipped", () => {
  const r = resolveLayers("demo", { daiPath: DAI });
  assert.equal(find(r, "agent", "qa-engineer").description, "Tests quality.");
  assert.equal(find(r, "workflow", "sprint-cycle").description, "Sprint loop");
  assert.equal(find(r, "workflow", "release").layer, "project");
  assert.ok(!r.items.some((i) => i.id === "ignored" || i.id.startsWith("00-")));
});

test("without DAI the other layers still resolve", () => {
  const r = resolveLayers("demo", { daiPath: null });
  assert.ok(!find(r, "agent", "qa-engineer"));
  assert.ok(find(r, "skill", "commit"));
});

test("project.json disables inherited items but never the project's own", () => {
  put(path.join(proj, "project.json"), JSON.stringify({ layers: { disable: { skills: ["bug-reporting", "only-here"], workflows: ["sprint-cycle"] } } }));
  const r = resolveLayers("demo", { daiPath: DAI });
  assert.ok(!find(r, "skill", "bug-reporting"));
  assert.ok(!find(r, "workflow", "sprint-cycle"));
  assert.ok(find(r, "skill", "only-here"), "own item stays");
  assert.deepEqual(r.disabled.map((d) => `${d.kind}:${d.id}`).sort(), ["skill:bug-reporting", "workflow:sprint-cycle"]);
  fs.rmSync(path.join(proj, "project.json"));
});

test("the AGENTS.md section describes project items and lists inherited ones by id", () => {
  const items = resolveLayers("demo", { daiPath: DAI }).items;
  const text = layersLines(items, "demo").join("\n");
  assert.match(text, /skill \*\*commit\*\* \[replaces dai, global\]: Project commit\./);
  assert.match(text, /workflow \*\*release\*\*/);
  assert.match(text, /Inherited agents \(1, ids only\): qa-engineer/);
  assert.match(text, /node tools\/layers\.js show demo --json/);
  assert.ok(!/Sprint loop/.test(text.split("Inherited")[1] || ""), "inherited items carry no description");
  const block = planCodex({ slug: "demo", layers: items }, { codexProjectsDir: TMP }).writes[0].content;
  assert.match(block, /## Skills, agents and workflows/);
  assert.match(planCodex({ slug: "demo", layers: [] }, { codexProjectsDir: TMP }).writes[0].content, /No skills, agents or workflows found/);
});

test("the CLI shows origin and overrides, supports --json and rejects an unknown project", () => {
  const out = []; const io = { log: (m) => out.push(m) };
  layersCli.run(["show", "demo"], io, { daiPath: DAI });
  assert.match(out.join("\n"), /project\s+commit\s+\(substitui dai, global\)/);
  const js = []; layersCli.run(["show", "demo", "--json", "--kind", "agent"], { log: (m) => js.push(m) }, { daiPath: DAI });
  assert.deepEqual(JSON.parse(js[0]).items.map((i) => i.id), ["qa-engineer"]);
  assert.throws(() => layersCli.run(["show", "nope"], io, { daiPath: DAI }), /não existe/);
});

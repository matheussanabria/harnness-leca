// Project-layer writer, the /layers API, the CLI create command, the template tree and the catalog section.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { removeDir } = require("./helpers/temp-dir");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-layers-write-"));
process.env.HARNESS_ROOT = TMP;
process.env.HARNESS_ENGINE_HOST = "0";
for (const p of ["_template", "demo"]) fs.mkdirSync(path.join(TMP, "projects", p), { recursive: true });
fs.mkdirSync(path.join(TMP, "global"), { recursive: true });
fs.writeFileSync(path.join(TMP, "projects", ".active"), "demo\n");

const { createItem, deleteItem } = require("../tools/lib/layers/writer");
const { resolveLayers } = require("../tools/lib/layers/resolve");
const layersCli = require("../tools/layers");
const { createServer } = require("../ui/server");

const proj = path.join(TMP, "projects", "demo");
let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  server.closeAllConnections();
  server.close();
  require("../ui/server/db/connection").closeDb();
  await new Promise((resolve) => setTimeout(resolve, 250));
  removeDir(TMP);
});
const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });

test("createItem writes the DAI formats and the scanner finds them on the project layer", () => {
  createItem({ slug: "demo", kind: "agent", id: "reviewer", description: "Reviews diffs." });
  createItem({ slug: "demo", kind: "workflow", id: "release", description: "Release loop." });
  createItem({ slug: "demo", kind: "skill", id: "deploy-notes", description: "Writes deploy notes." });
  assert.ok(fs.existsSync(path.join(proj, "agents", "reviewer", "AGENT.md")));
  assert.ok(fs.existsSync(path.join(proj, "workflows", "release", "manifest.yaml")));
  assert.ok(fs.existsSync(path.join(proj, "workflows", "release", "WORKFLOW.md")));
  const { items } = resolveLayers("demo", { daiPath: null });
  const by = (k, id) => items.find((i) => i.kind === k && i.id === id);
  assert.equal(by("agent", "reviewer").layer, "project");
  assert.equal(by("agent", "reviewer").description, "Reviews diffs.");
  assert.equal(by("workflow", "release").description, "Release loop.");
  assert.equal(by("skill", "deploy-notes").description, "Writes deploy notes.");
});

test("createItem never overwrites and rejects ids that could escape the folder", () => {
  fs.writeFileSync(path.join(proj, "agents", "reviewer", "AGENT.md"), "# mine\n");
  assert.throws(() => createItem({ slug: "demo", kind: "agent", id: "reviewer" }), /Já existe/);
  assert.equal(fs.readFileSync(path.join(proj, "agents", "reviewer", "AGENT.md"), "utf8"), "# mine\n");
  for (const bad of ["../x", "a/b", "..", ".hidden", "", "a".repeat(80)]) {
    assert.throws(() => createItem({ slug: "demo", kind: "agent", id: bad }), /Id inválido/, bad);
  }
  assert.throws(() => createItem({ slug: "demo", kind: "tool", id: "x" }), /Tipo inválido/);
  assert.throws(() => createItem({ slug: "nope", kind: "agent", id: "x" }), /Projeto não encontrado/);
});

test("deleteItem removes only the item folder of the project layer", () => {
  fs.writeFileSync(path.join(TMP, "projects", "keep.txt"), "x");
  assert.equal(deleteItem({ slug: "demo", kind: "skill", id: "deploy-notes" }), true);
  assert.ok(!fs.existsSync(path.join(proj, "skills", "deploy-notes")));
  assert.ok(fs.existsSync(path.join(proj, "skills")), "the kind folder stays");
  assert.equal(deleteItem({ slug: "demo", kind: "skill", id: "deploy-notes" }), false);
  assert.throws(() => deleteItem({ slug: "demo", kind: "agent", id: "../../keep.txt" }), /Id inválido/);
  assert.ok(fs.existsSync(path.join(TMP, "projects", "keep.txt")));
});

test("GET /layers returns the effective set; POST creates (201), refuses duplicates (409) and bad input (400)", async () => {
  const list = await (await fetch(`${base}/api/project/demo/layers`)).json();
  assert.ok(list.items.some((i) => i.id === "reviewer" && i.layer === "project"));
  assert.equal((await fetch(`${base}/api/project/nope/layers`)).status, 404);

  const ok = await post("/api/project/demo/layers", { kind: "agent", id: "planner", description: "Plans." });
  assert.equal(ok.status, 201);
  assert.equal((await post("/api/project/demo/layers", { kind: "agent", id: "planner" })).status, 409);
  assert.equal((await post("/api/project/demo/layers", { kind: "agent", id: "../bad" })).status, 400);
  assert.equal((await post("/api/project/demo/layers", { kind: "agent" })).status, 400);
});

test("POST /layers/delete needs confirm: true and answers 404 for what is not on the project layer", async () => {
  assert.equal((await post("/api/project/demo/layers/delete", { kind: "agent", id: "planner" })).status, 400);
  assert.ok(fs.existsSync(path.join(proj, "agents", "planner")), "refusal removes nothing");
  assert.equal((await post("/api/project/demo/layers/delete", { kind: "agent", id: "planner", confirm: true })).status, 200);
  assert.equal((await post("/api/project/demo/layers/delete", { kind: "agent", id: "planner", confirm: true })).status, 404);
});

test("CLI create writes on the project layer and reports misuse", () => {
  const out = [];
  layersCli.run(["create", "demo", "agent", "cli-made", "--description", "From the CLI."], { log: (m) => out.push(m) });
  assert.match(out[0], /Criado agent cli-made/);
  assert.equal(resolveLayers("demo", { daiPath: null }).items.find((i) => i.id === "cli-made").description, "From the CLI.");
  assert.throws(() => layersCli.run(["create", "demo", "agent"], { log() {} }), /Uso/);
  assert.throws(() => layersCli.run(["create", "demo", "agent", "cli-made"], { log() {} }), /Já existe/);
});

test("the project template ships the layer folders and a project.json with the disable lists", () => {
  const tpl = path.join(__dirname, "..", "projects", "_template");
  for (const d of ["skills", "agents", "workflows"]) assert.ok(fs.existsSync(path.join(tpl, d)), d);
  const cfg = JSON.parse(fs.readFileSync(path.join(tpl, "project.json"), "utf8"));
  assert.deepEqual(Object.keys(cfg.layers.disable).sort(), ["agents", "skills", "workflows"]);
});

test("the catalog page carries the layers section, accessibly, with no emojis", () => {
  const pub = path.join(__dirname, "..", "ui", "public");
  const html = fs.readFileSync(path.join(pub, "catalogo.html"), "utf8");
  assert.match(html, /id="kLayers"/);
  assert.match(html, /id="lyMsg"[^>]*aria-live="polite"/);
  assert.match(html, /startLayersSection/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(fs.readFileSync(path.join(pub, "js", "catalogo", "catalogo-layers.js"), "utf8")));
});

test("content: read and save only the known files of an existing project-layer item", async () => {
  createItem({ slug: "demo", kind: "workflow", id: "flow", description: "A flow." });
  const got = await (await fetch(`${base}/api/project/demo/layers/content?kind=workflow&id=flow`)).json();
  assert.deepEqual(got.files.map((f) => f.name), ["manifest.yaml", "WORKFLOW.md"]);

  const save = (body) => post("/api/project/demo/layers/content", body);
  assert.equal((await save({ kind: "workflow", id: "flow", file: "WORKFLOW.md", text: "# Edited\n" })).status, 200);
  assert.equal(fs.readFileSync(path.join(proj, "workflows", "flow", "WORKFLOW.md"), "utf8"), "# Edited\n");

  assert.equal((await save({ kind: "workflow", id: "flow", file: "../../instructions.md", text: "x" })).status, 400, "file outside the allowlist");
  assert.equal((await save({ kind: "workflow", id: "flow", file: "notes.txt", text: "x" })).status, 400);
  assert.equal((await save({ kind: "workflow", id: "ghost", file: "WORKFLOW.md", text: "x" })).status, 404, "never creates");
  assert.equal((await save({ kind: "workflow", id: "flow", file: "WORKFLOW.md", text: "x".repeat(201 * 1024) })).status, 400, "size cap");
  assert.equal((await fetch(`${base}/api/project/demo/layers/content?kind=agent&id=..`)).status, 400);
  assert.equal(fs.readFileSync(path.join(proj, "workflows", "flow", "WORKFLOW.md"), "utf8"), "# Edited\n", "refusals change nothing");
});

test("GET /layers marks as editable only items that live in projects/<slug>/<kind>s/", async () => {
  const repo = path.join(TMP, "work-repo");
  fs.mkdirSync(path.join(repo, ".agents", "skills", "from-repo"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".agents", "skills", "from-repo", "SKILL.md"), "---\nname: from-repo\ndescription: In the repo.\n---\n");
  fs.writeFileSync(path.join(proj, "mcp.json"), JSON.stringify({ repo }));
  const list = await (await fetch(`${base}/api/project/demo/layers`)).json();
  const byId = (id) => list.items.find((i) => i.id === id);
  assert.equal(byId("flow").editable, true);
  assert.equal(byId("from-repo").layer, "project", "mcp.json repo skills are read for every project, no project.json needed");
  assert.equal(byId("from-repo").editable, false);
  assert.equal((await post("/api/project/demo/layers/content", { kind: "skill", id: "from-repo", file: "SKILL.md", text: "x" })).status, 404);
  fs.rmSync(path.join(proj, "mcp.json"));
});

test("the skill mirror writes into a working repository only when project.json opts in", () => {
  const { mirrorProjectSkills } = require("../tools/lib/skill-mirror");
  const repo = path.join(TMP, "mirror-repo");
  fs.mkdirSync(path.join(repo, ".agents", "skills", "alpha"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".agents", "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: A.\n---\n");
  fs.writeFileSync(path.join(proj, "mcp.json"), JSON.stringify({ repo }));
  mirrorProjectSkills("demo");
  assert.ok(!fs.existsSync(path.join(repo, ".claude")), "default: the user's repository is left alone");
  fs.writeFileSync(path.join(proj, "project.json"), JSON.stringify({ mirrorToWorkspace: true }));
  mirrorProjectSkills("demo");
  assert.ok(fs.existsSync(path.join(repo, ".claude", "skills", "alpha", "SKILL.md")), "opt-in mirrors");
  fs.rmSync(path.join(proj, "mcp.json"));
  fs.rmSync(path.join(proj, "project.json"));
});

test("the catalog form comes before the filter toolbar and the editor is accessible", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "catalogo.html"), "utf8");
  assert.ok(html.indexOf('id="lyForm"') < html.indexOf('id="lyKind"'), "creation form above the filter");
  assert.match(html, /id="lyEdMsg"[^>]*aria-live="polite"/);
  assert.match(html, /for="lyEdText"/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { listTree, readItemFile } = require("../ui/server/services/catalog/catalog-files");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-files-"));
  const skills = path.join(dir, "skills");
  const agents = path.join(dir, "agents");
  fs.mkdirSync(path.join(skills, "demo", "references"), { recursive: true });
  fs.mkdirSync(path.join(skills, "demo", "node_modules"), { recursive: true });
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(skills, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill.\n---\n# Demo");
  fs.writeFileSync(path.join(skills, "demo", "manifest.yaml"), "a: 1\n");
  fs.writeFileSync(path.join(skills, "demo", "references", "guide.md"), "# Guide");
  fs.writeFileSync(path.join(skills, "demo", "logo.bin"), Buffer.from([0, 1, 2, 3]));
  fs.writeFileSync(path.join(skills, "demo", "data.txt"), Buffer.from([65, 0, 66]));
  fs.writeFileSync(path.join(skills, "demo", "node_modules", "x.md"), "hidden");
  fs.writeFileSync(path.join(skills, "demo", ".secret.md"), "hidden");
  fs.writeFileSync(path.join(dir, "outside.md"), "OUTSIDE");
  fs.writeFileSync(path.join(agents, "helper.md"), "---\nname: helper\ndescription: Helper agent.\n---\nbody");
  const sources = { skills: [{ id: "user", label: "U", dir: skills }], agents: [{ id: "user", label: "U", dir: agents }] };
  return { dir, skills, sources };
}

test("catalog items carry the ref used to browse them", () => {
  const f = fixture();
  const cat = buildCatalog({ sources: f.sources, overridesFile: path.join(f.dir, "o.json") });
  assert.equal(cat.items.find((i) => i.name === "demo").ref, "demo");
  assert.equal(cat.items.find((i) => i.name === "helper").ref, "helper.md");
});

test("skill tree lists folders first, hides dot entries and node_modules", () => {
  const f = fixture();
  const { tree } = listTree("skill", "user", "demo", f.sources);
  assert.equal(tree[0].type, "dir");
  assert.equal(tree[0].name, "references");
  assert.deepEqual(tree[0].children.map((c) => c.path), ["references/guide.md"]);
  const names = tree.map((n) => n.name);
  assert.ok(names.includes("SKILL.md") && !names.includes("node_modules") && !names.includes(".secret.md"));
});

test("agent tree is its single file", () => {
  const f = fixture();
  const { tree } = listTree("agent", "user", "helper.md", f.sources);
  assert.deepEqual(tree.map((n) => n.path), ["helper.md"]);
  assert.match(readItemFile("agent", "user", "helper.md", "helper.md", f.sources).content, /body/);
  assert.equal(readItemFile("agent", "user", "helper.md", "other.md", f.sources).status, 404);
});

test("reads text files, flags binary and null-byte content", () => {
  const f = fixture();
  const ok = readItemFile("skill", "user", "demo", "references/guide.md", f.sources);
  assert.equal(ok.status, 200);
  assert.equal(ok.content, "# Guide");
  assert.equal(readItemFile("skill", "user", "demo", "logo.bin", f.sources).binary, true);
  assert.equal(readItemFile("skill", "user", "demo", "data.txt", f.sources).binary, true);
});

test("rejects traversal, dot paths, bad refs and unknown sources", () => {
  const f = fixture();
  for (const rel of ["../../outside.md", "references/../../outside.md", ".secret.md", "references\\guide.md"]) {
    assert.equal(readItemFile("skill", "user", "demo", rel, f.sources).status, 400, rel);
  }
  assert.equal(listTree("skill", "user", "../agents", f.sources), null);
  assert.equal(listTree("skill", "user", "..", f.sources), null);
  assert.equal(listTree("skill", "nope", "demo", f.sources), null);
  assert.equal(listTree("other", "user", "demo", f.sources), null);
  assert.equal(readItemFile("skill", "user", "missing", "SKILL.md", f.sources).status, 404);
});

test("a symlink pointing outside the item is not followed", (t) => {
  const f = fixture();
  try {
    fs.symlinkSync(path.join(f.dir, "outside.md"), path.join(f.skills, "demo", "link.md"));
  } catch {
    return t.skip("symlink unavailable in this environment");
  }
  assert.ok(!listTree("skill", "user", "demo", f.sources).tree.some((n) => n.name === "link.md"));
  assert.equal(readItemFile("skill", "user", "demo", "link.md", f.sources).status, 400);
});

test("tree view: picks SKILL.md, escapes names, no emoji", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "catalogo", "catalogo-tree.js")).href);
  const nodes = [
    { type: "dir", name: "references", path: "references", children: [{ type: "file", name: "a.md", path: "references/a.md", size: 10 }] },
    { type: "file", name: "<x>.md", path: "<x>.md", size: 2048 },
    { type: "file", name: "SKILL.md", path: "SKILL.md", size: 5 },
  ];
  assert.equal(mod.pickDefaultFile(nodes), "SKILL.md");
  assert.equal(mod.pickDefaultFile([{ type: "file", name: "agent.md", path: "agent.md", size: 1 }]), "agent.md");
  const html = mod.renderTree(nodes, "references/a.md");
  assert.ok(html.includes("&lt;x&gt;.md") && !html.includes("<x>"));
  assert.ok(html.includes('<details class="k-dir" open>'));
  assert.ok(html.includes("2.0 KB"));
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(html));
  assert.deepEqual(mod.splitFrontmatter("---\nname: a\n---\n# T"), { meta: "name: a", body: "# T" });
  assert.equal(mod.splitFrontmatter("# T").meta, "");
});

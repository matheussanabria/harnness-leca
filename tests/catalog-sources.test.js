const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { listSources, listProjectSlugs, safeId } = require("../ui/server/services/catalog/catalog-sources");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");
const { listTree, readItemFile } = require("../ui/server/services/catalog/catalog-files");

const skill = (dir, name, desc) => {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(path.join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody ${desc}`);
};

// <tmp>/home/.claude/{skills,agents}, <tmp>/root/.agents/skills, <tmp>/root/projects/{demo,_template,.hidden}
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-src-"));
  const home = path.join(tmp, "home");
  const root = path.join(tmp, "root");
  const repo = path.join(tmp, "repo-web");
  skill(path.join(home, ".claude", "skills"), "shared", "from user");
  skill(path.join(root, ".agents", "skills"), "harness-only", "from harness");
  skill(path.join(repo, ".agents", "skills"), "shared", "from project");
  skill(path.join(repo, ".agents", "skills"), "project-only", "from project");
  fs.mkdirSync(path.join(repo, ".claude", "agents"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".claude", "agents", "reviewer.md"), "---\nname: reviewer\ndescription: project agent\n---\nbody");
  for (const p of ["demo", "_template", ".hidden"]) fs.mkdirSync(path.join(root, "projects", p), { recursive: true });
  const projectTargets = (slug) => (slug === "demo" ? [{ id: "web", label: "web (Raiz)", path: repo }] : []);
  return { home, root, repo, opts: { home, root, projectTargets } };
}

test("project folders skip templates and dot folders", () => {
  const f = fixture();
  assert.deepEqual(listProjectSlugs(f.root), ["demo"]);
});

test("registry order is user, harness, then project repos, with url-safe ids", () => {
  const f = fixture();
  const src = listSources(f.opts);
  assert.deepEqual(src.skills.map((s) => s.scope), ["user", "harness", "project"]);
  assert.match(src.skills[2].id, /^[A-Za-z0-9._-]+$/);
  assert.equal(src.skills[2].label, "demo / web (Raiz)");
  assert.equal(src.agents.length, 2);
  assert.equal(src.agents[1].scope, "project");
  assert.equal(safeId("p", "a b", "c/d"), "p-a-b-c-d");
});

test("project skills and agents appear in the catalog", () => {
  const f = fixture();
  const cat = buildCatalog({ sources: listSources(f.opts), overridesFile: path.join(f.home, "o.json") });
  const names = cat.items.map((i) => `${i.kind}:${i.name}`);
  assert.ok(names.includes("skill:project-only") && names.includes("skill:harness-only") && names.includes("agent:reviewer"));
  assert.equal(cat.items.find((i) => i.name === "project-only").scope, "project");
});

test("a name in several sources appears once; the first source wins and the rest are listed", () => {
  const f = fixture();
  const cat = buildCatalog({ sources: listSources(f.opts), overridesFile: path.join(f.home, "o.json") });
  const shared = cat.items.filter((i) => i.name === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].scope, "user");
  assert.match(shared[0].description, /from user/);
  assert.deepEqual(shared[0].alsoIn, ["demo / web (Raiz)"]);
});

test("a repo target that is the harness itself is not listed twice", () => {
  const f = fixture();
  const selfTarget = { id: "repo-root", label: "harness (Raiz)", path: f.root };
  const src = listSources({ ...f.opts, projectTargets: () => [selfTarget] });
  assert.equal(src.skills.filter((s) => path.resolve(s.dir) === path.resolve(path.join(f.root, ".agents", "skills"))).length, 1);
});

test("files of a project item can be browsed through its source id", () => {
  const f = fixture();
  const src = listSources(f.opts);
  const id = src.skills[2].id;
  const tree = listTree("skill", id, "project-only", src);
  assert.deepEqual(tree.tree.map((n) => n.name), ["SKILL.md"]);
  assert.match(readItemFile("skill", id, "project-only", "SKILL.md", src).content, /from project/);
  const agentId = src.agents[1].id;
  assert.match(readItemFile("agent", agentId, "reviewer.md", "reviewer.md", src).content, /project agent/);
});

test("a missing project folder or an empty registry does not throw", () => {
  const f = fixture();
  const src = listSources({ ...f.opts, projectTargets: () => [{ id: "x", label: "x", path: path.join(f.root, "nope") }] });
  assert.equal(src.skills.length, 2);
  assert.doesNotThrow(() => buildCatalog({ sources: src, overridesFile: path.join(f.home, "o.json") }));
});

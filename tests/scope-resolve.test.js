const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-"));
for (const d of ["alfa", "beta", "_template", "_pessoal"]) fs.mkdirSync(path.join(dir, d));
fs.writeFileSync(path.join(dir, ".active"), "beta\n");
process.env.HARNESS_PROJECTS_DIR = dir;
const { slugs } = require("../ui/server/config");
const { resolveScope, acceptsScope } = require("../ui/server/scope/resolve-scope");
const { personalDir, ensurePersonalWorkspace } = require("../ui/server/scope/personal-workspace");
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const req = (project) => ({ headers: project === undefined ? {} : { "x-harness-project": project } });

test("the header wins over .active", () => {
  const s = resolveScope(req("alfa"));
  assert.deepEqual([s.ok, s.projectSlug, s.source], [true, "alfa", "header"]);
});

test("without a header, .active is only the default", () => {
  assert.equal(resolveScope(req()).projectSlug, "beta");
  assert.equal(resolveScope(req(), { fallbackActive: false }).projectSlug, null);
});

test("none and _pessoal select the personal workspace", () => {
  for (const v of ["none", "_pessoal", ""]) {
    const s = resolveScope(req(v));
    assert.deepEqual([s.ok, s.projectSlug, s.workspace, s.personal], [true, null, "_pessoal", true]);
  }
});

test("an unknown slug is an error", () => {
  assert.equal(resolveScope(req("nao-existe")).ok, false);
});

test("_pessoal and _template are never listed as projects", () => {
  assert.deepEqual(slugs().sort(), ["alfa", "beta"]);
});

test("acceptsScope allows real projects and the personal slug, nothing else", () => {
  assert.equal(acceptsScope("alfa"), true);
  assert.equal(acceptsScope("_pessoal"), true);
  assert.equal(acceptsScope("_template"), false);
  assert.equal(acceptsScope("nao-existe"), false);
  assert.equal(acceptsScope(undefined), false);
});

test("the personal workspace is created once with the standard structure and never overwritten", () => {
  fs.rmSync(personalDir(), { recursive: true, force: true });
  ensurePersonalWorkspace();
  for (const p of ["chats", "context", "scheduled", "instructions.md", "memory.md"]) {
    assert.ok(fs.existsSync(path.join(personalDir(), p)), p);
  }
  fs.writeFileSync(path.join(personalDir(), "memory.md"), "mine", "utf8");
  ensurePersonalWorkspace();
  assert.equal(fs.readFileSync(path.join(personalDir(), "memory.md"), "utf8"), "mine");
});

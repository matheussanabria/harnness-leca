const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readItemFile } = require("../ui/server/services/catalog/catalog-files");
const { writeItemFile } = require("../ui/server/services/catalog/catalog-write");

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-write-"));
  const skills = path.join(dir, "skills");
  const agents = path.join(dir, "agents");
  fs.mkdirSync(path.join(skills, "demo", "references"), { recursive: true });
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(skills, "demo", "SKILL.md"), "---\nname: demo\n---\n# Demo");
  fs.writeFileSync(path.join(skills, "demo", "references", "bom.md"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# Bom")]));
  fs.writeFileSync(path.join(skills, "demo", "logo.bin"), Buffer.from([0, 1, 2]));
  fs.writeFileSync(path.join(dir, "outside.md"), "OUTSIDE");
  fs.writeFileSync(path.join(agents, "helper.md"), "---\nname: helper\n---\nbody");
  const sources = { skills: [{ id: "user", label: "U", dir: skills }], agents: [{ id: "user", label: "U", dir: agents }] };
  return { dir, skills, agents, sources };
}
const req = (sources, over) => ({ kind: "skill", source: "user", ref: "demo", path: "SKILL.md", content: "new", revision: "x", ...over });
const rev = (sources, over = {}) => readItemFile(over.kind || "skill", "user", over.ref || "demo", over.path || "SKILL.md", sources).revision;

test("saves with the current revision and returns the new one", () => {
  const { skills, sources } = fixture();
  const r1 = rev(sources);
  assert.ok(r1);
  const out = writeItemFile(req(sources, { content: "# Changed\n", revision: r1 }), sources);
  assert.equal(out.status, 200);
  assert.equal(fs.readFileSync(path.join(skills, "demo", "SKILL.md"), "utf8"), "# Changed\n");
  assert.equal(out.revision, rev(sources));
  assert.notEqual(out.revision, r1);
});

test("a stale revision is a 409 and leaves the file untouched", () => {
  const { skills, sources } = fixture();
  const stale = rev(sources);
  fs.writeFileSync(path.join(skills, "demo", "SKILL.md"), "edited elsewhere");
  const out = writeItemFile(req(sources, { content: "mine", revision: stale }), sources);
  assert.equal(out.status, 409);
  assert.equal(out.currentRevision, rev(sources));
  assert.equal(fs.readFileSync(path.join(skills, "demo", "SKILL.md"), "utf8"), "edited elsewhere");
});

test("edits an agent file and keeps no temp files behind", () => {
  const { agents, sources } = fixture();
  const revision = rev(sources, { kind: "agent", ref: "helper.md", path: "helper.md" });
  const out = writeItemFile(req(sources, { kind: "agent", ref: "helper.md", path: "helper.md", content: "agent v2", revision }), sources);
  assert.equal(out.status, 200);
  assert.equal(fs.readFileSync(path.join(agents, "helper.md"), "utf8"), "agent v2");
  assert.deepEqual(fs.readdirSync(agents), ["helper.md"]);
});

test("keeps the UTF-8 BOM of the original file", () => {
  const { skills, sources } = fixture();
  const revision = rev(sources, { path: "references/bom.md" });
  assert.equal(writeItemFile(req(sources, { path: "references/bom.md", content: "# Novo", revision }), sources).status, 200);
  const bytes = fs.readFileSync(path.join(skills, "demo", "references", "bom.md"));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(bytes.subarray(3).toString("utf8"), "# Novo");
});

test("rejects traversal, dot paths, unknown items and missing files", () => {
  const { dir, sources } = fixture();
  for (const p of ["../../outside.md", "../outside.md", ".secret.md", "a/../../outside.md", "..\outside.md"]) {
    const out = writeItemFile(req(sources, { path: p }), sources);
    assert.ok(out.status === 400 || out.status === 404, `${p} -> ${out.status}`);
  }
  assert.equal(writeItemFile(req(sources, { ref: "../skills" }), sources).status, 404);
  assert.equal(writeItemFile(req(sources, { source: "nope" }), sources).status, 404);
  assert.equal(writeItemFile(req(sources, { path: "missing.md" }), sources).status, 404);
  assert.equal(fs.readFileSync(path.join(dir, "outside.md"), "utf8"), "OUTSIDE");
});

test("does not create files, edit folders or binary files", () => {
  const { skills, sources } = fixture();
  assert.equal(writeItemFile(req(sources, { path: "new.md" }), sources).status, 404);
  assert.equal(writeItemFile(req(sources, { path: "references" }), sources).status, 400);
  assert.equal(writeItemFile(req(sources, { path: "logo.bin", revision: "x" }), sources).status, 400);
  assert.equal(fs.existsSync(path.join(skills, "demo", "new.md")), false);
});

test("validates body: content type, size, NUL byte and missing revision", () => {
  const { sources } = fixture();
  const revision = rev(sources);
  assert.equal(writeItemFile(req(sources, { content: 5, revision }), sources).status, 400);
  assert.equal(writeItemFile(req(sources, { content: "a", revision: "" }), sources).status, 400);
  assert.equal(writeItemFile(req(sources, { content: "a\u0000b", revision }), sources).status, 400);
  assert.equal(writeItemFile(req(sources, { content: "x".repeat(256 * 1024 + 1), revision }), sources).status, 400);
});

test("a symlink pointing outside the item is refused", (t) => {
  const { dir, skills, sources } = fixture();
  try { fs.symlinkSync(path.join(dir, "outside.md"), path.join(skills, "demo", "link.md")); } catch { return t.skip("symlinks unavailable"); }
  const out = writeItemFile(req(sources, { path: "link.md", revision: "x" }), sources);
  assert.ok(out.status === 400 || out.status === 404);
  assert.equal(fs.readFileSync(path.join(dir, "outside.md"), "utf8"), "OUTSIDE");
});

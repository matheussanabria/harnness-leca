// Project skills visible to every engine: workspace discovery, the Claude mirror and the skills list in AGENTS.md.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-skill-mirror-"));
process.env.HARNESS_ROOT = TMP;
const projDir = path.join(TMP, "projects", "demo");
fs.mkdirSync(projDir, { recursive: true });
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { findProjectTargets } = require("../tools/lib/skills/targets");
const { mirrorTarget, mirrorProjectSkills, MARK } = require("../tools/lib/skill-mirror");
const { planCodex } = require("../tools/lib/export/codex");

const repo = path.join(TMP, "repo");
const skill = (name, body = "x") => {
  const dir = path.join(repo, ".agents", "skills", name);
  fs.mkdirSync(path.join(dir, "references"), { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Does ${name} things.\n---\n\n# ${name}\n${body}\n`);
  fs.writeFileSync(path.join(dir, "references", "ref.md"), `ref ${body}\n`);
};
const mirrorOf = (name) => path.join(repo, ".claude", "skills", name);

test("project.json workspace widens skill discovery; a relative path resolves against the harness root", () => {
  fs.mkdirSync(repo, { recursive: true });
  skill("alpha");
  assert.ok(!findProjectTargets("demo").some((t) => t.id === "repo-root"));
  fs.writeFileSync(path.join(projDir, "project.json"), JSON.stringify({ workspace: "repo" }));
  const root = findProjectTargets("demo").find((t) => t.id === "repo-root");
  assert.equal(root?.path, repo);
  assert.equal(root?.hasAgents, true);
});

test("mirror copies skills with their references and marks them", () => {
  skill("beta");
  const r = mirrorTarget({ targetPath: repo });
  assert.deepEqual(r.created.sort(), ["alpha", "beta"]);
  assert.ok(fs.existsSync(path.join(mirrorOf("alpha"), "SKILL.md")));
  assert.ok(fs.existsSync(path.join(mirrorOf("alpha"), "references", "ref.md")));
  assert.ok(fs.existsSync(path.join(mirrorOf("alpha"), MARK)));
});

test("a second run changes nothing; a source edit updates only that skill", () => {
  assert.deepEqual(mirrorTarget({ targetPath: repo }).unchanged.sort(), ["alpha", "beta"]);
  skill("beta", "edited");
  const r = mirrorTarget({ targetPath: repo });
  assert.deepEqual(r.updated, ["beta"]);
  assert.match(fs.readFileSync(path.join(mirrorOf("beta"), "SKILL.md"), "utf8"), /edited/);
});

test("the user's own skill without the sidecar is never touched", () => {
  const own = mirrorOf("mine");
  fs.mkdirSync(own, { recursive: true });
  fs.writeFileSync(path.join(own, "SKILL.md"), "mine");
  skill("mine", "from the project"); // same name in the source
  const r = mirrorTarget({ targetPath: repo });
  assert.deepEqual(r.skipped, ["mine"]);
  assert.equal(fs.readFileSync(path.join(own, "SKILL.md"), "utf8"), "mine");
});

test("a mirrored skill whose source disappeared is removed; dry-run writes nothing", () => {
  fs.rmSync(path.join(repo, ".agents", "skills", "alpha"), { recursive: true });
  assert.deepEqual(mirrorTarget({ targetPath: repo, dryRun: true }).removed, ["alpha"]);
  assert.ok(fs.existsSync(mirrorOf("alpha")), "dry-run keeps the mirror");
  assert.deepEqual(mirrorTarget({ targetPath: repo }).removed, ["alpha"]);
  assert.ok(!fs.existsSync(mirrorOf("alpha")));
  assert.ok(fs.existsSync(mirrorOf("mine")), "user's skill survives");
});

test("mirrorProjectSkills walks the project targets", () => {
  const total = mirrorProjectSkills("demo");
  assert.equal(total.created, 0);
  assert.ok(total.unchanged >= 1);
});

test("AGENTS.md block lists the project skills and tells the engine when to open them", () => {
  const skills = [{ name: "beta", description: "Does beta things.", file: "C:/repo/.agents/skills/beta/SKILL.md" }];
  const text = planCodex({ slug: "demo", skills }, { codexProjectsDir: TMP }).writes[0].content;
  assert.match(text, /## Project skills/);
  assert.match(text, /\*\*beta\*\*: Does beta things\./);
  assert.match(text, /C:\/repo\/\.agents\/skills\/beta\/SKILL\.md/);
  const none = planCodex({ slug: "demo", skills: [] }, { codexProjectsDir: TMP }).writes[0].content;
  assert.match(none, /No project skills found/);
});

test("discovery skips dot folders: an agent worktree (a full repo copy) is not a skill target", () => {
  const copy = path.join(repo, ".codex", "worktrees", "wt", ".agents", "skills", "dup");
  fs.mkdirSync(copy, { recursive: true });
  fs.writeFileSync(path.join(copy, "SKILL.md"), "x");
  fs.writeFileSync(path.join(repo, ".codex", "worktrees", "wt", "package.json"), "{}");
  const paths = findProjectTargets("demo").map((t) => t.path);
  assert.ok(!paths.some((p) => p.includes(`${path.sep}.codex`)));
});

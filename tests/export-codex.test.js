// Codex export adapter: managed block in projects/<slug>/AGENTS.md, non destructive, size capped.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");

const ROOT = makeTempDir("harness-export-codex-", test);
process.env.HARNESS_ROOT = ROOT;
const projectDir = path.join(ROOT, "projects", "demo");
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(projectDir, "instructions.md"), "# Instruções do projeto\n<!-- comment that must not leak -->\nAlways answer in Portuguese.\n");
fs.writeFileSync(path.join(projectDir, "memory.md"), "# Memória\n\n- [rule](memory/feedback/rule.md) — a curated rule\n");
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const { planCodex, capBytes, MAX_BYTES } = require("../tools/lib/export/codex");
const { run } = require("../tools/export-context");

const agentsFile = path.join(projectDir, "AGENTS.md");
const quiet = { log() {} };
const options = (base) => ({ claudeProjectsDir: path.join(base, "c"), geminiHome: path.join(base, "g") });

test("plan carries instructions and the memory index, without HTML comments", () => {
  const plan = planCodex({ slug: "demo", instructionsMd: "# T\n<!-- hidden -->\nUse tabs.", memoryMd: "- [a](memory/a.md) — x" }, { codexProjectsDir: path.join(ROOT, "projects") });
  const text = plan.writes[0].content;
  assert.match(text, /Use tabs\./);
  assert.match(text, /\[a\]\(memory\/a\.md\)/);
  assert.doesNotMatch(text, /hidden/);
  assert.equal(plan.writes[0].kind, "managed");
});

test("empty instructions are stated plainly instead of leaving the engine guessing", () => {
  const { writes } = planCodex({ slug: "demo", instructionsMd: "# Instruções do projeto\n<!-- only a comment -->", memoryMd: "" }, { codexProjectsDir: ROOT });
  assert.match(writes[0].content, /No project instructions configured yet/);
  assert.match(writes[0].content, /No curated memory yet/);
});

test("capBytes keeps the block under the Codex project doc limit", () => {
  const big = capBytes("line\n".repeat(50_000), MAX_BYTES);
  assert.ok(Buffer.byteLength(big, "utf8") <= MAX_BYTES + 100);
  assert.match(big, /truncated/);
});

test("export writes projects/<slug>/AGENTS.md, preserves hand-written text and is idempotent", () => {
  const base = makeTempDir("export-codex-base-", test);
  fs.writeFileSync(agentsFile, "# My own notes\nkeep me\n");
  run(["--project", "demo"], quiet, options(base));
  const first = fs.readFileSync(agentsFile, "utf8");
  assert.match(first, /keep me/);
  assert.match(first, /<!-- harness:begin -->[\s\S]*Always answer in Portuguese[\s\S]*<!-- harness:end -->/);
  assert.doesNotMatch(first, /comment that must not leak/);

  run(["--project", "demo"], quiet, options(base));
  assert.equal(fs.readFileSync(agentsFile, "utf8"), first, "second run changes nothing");
});

test("dry-run writes nothing for Codex", () => {
  fs.rmSync(agentsFile, { force: true });
  run(["--project", "demo", "--dry-run"], quiet, options(makeTempDir("export-codex-dry-", test)));
  assert.equal(fs.existsSync(agentsFile), false);
});

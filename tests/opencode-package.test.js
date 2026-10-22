// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseStory, toPattern, EPIC_DIR } = require("../tools/lib/opencode-package/story");
const { findViolations, patternToRegExp } = require("../tools/lib/opencode-package/guard");
const { packageConfig, AGENT } = require("../tools/lib/opencode-package/config");
const { buildPrompt } = require("../tools/lib/opencode-package/prompt");
const { runPackage, verifyStory } = require("../tools/lib/opencode-package/run");

const REAL_ROOT = path.resolve(__dirname, "..");

const STORY = `---
id: EP-99.01
titulo: Historia de teste
epico: EP-99
dependencias: [99.00]
---

# EP-99.01

## 5. Arquivos que esta história pode tocar
- \`src/a.js\`
- src/lib/**
- tests/*.test.js (somente os novos)

Texto depois.

## 6. Testes
nada
`;

/** Repositório git temporário com uma história e a branch base ep14/integracao. */
function tempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hl-pkg-test-"));
  const sh = (/** @type {string[]} */ ...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  sh("init", "-q", "-b", "main");
  sh("config", "user.email", "t@t");
  sh("config", "user.name", "t");
  fs.mkdirSync(path.join(root, EPIC_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, EPIC_DIR, "99.01-historia.md"), STORY.replace("EP-99", "EP-14"));
  fs.writeFileSync(path.join(root, "README.md"), "x");
  sh("add", "-A");
  sh("commit", "-q", "-m", "init");
  sh("branch", "ep14/integracao");
  return { root, sh };
}

test("toPattern tira crases e o comentário entre parênteses", () => {
  assert.equal(toPattern("- `src/a.js`"), "src/a.js");
  assert.equal(toPattern("- tests/*.test.js (somente os novos)"), "tests/*.test.js");
});

test("parseStory lê branch, dependências e a lista permitida das histórias reais", () => {
  const s = parseStory(REAL_ROOT, "14.03");
  assert.equal(s.branch, "ep14/14.03-executor-opencode");
  assert.ok(s.allowed.includes("tools/opencode-package.js"));
  assert.deepEqual(parseStory(REAL_ROOT, "14.05").deps, ["14.04"]);
  assert.throws(() => parseStory(REAL_ROOT, "14.99"), /não encontrada/);
  assert.throws(() => parseStory(REAL_ROOT, "../x"), /inválido/);
});

test("guard: aceita o que cabe na lista e aponta o que escapa", () => {
  const allowed = ["src/a.js", "src/lib/**", "tests/*.test.js"];
  assert.deepEqual(findViolations(["src/a.js", "src/lib/x/y.js", "tests/z.test.js"], allowed), []);
  assert.deepEqual(findViolations(["src/b.js", "tests/sub/z.test.js", "ui/server/router.js"], allowed), ["src/b.js", "tests/sub/z.test.js", "ui/server/router.js"]);
  assert.ok(patternToRegExp("tools/").test("tools/x.js"));
});

test("config: edição liberada, shell restrito a testes e git de leitura, sem rede nem diretório externo", () => {
  const p = packageConfig().permission;
  assert.equal(p.edit, "allow");
  assert.equal(p.bash["*"], "deny");
  assert.equal(p.bash["node --test*"], "allow");
  assert.equal(p.bash["git add*"], undefined);
  assert.equal(p.webfetch, "deny");
  assert.equal(p.external_directory, "deny");
  assert.ok(packageConfig().agent[AGENT]);
});

test("prompt inclui regras, lista permitida e a história", () => {
  const text = buildPrompt({ id: "99.01", title: "T", body: "CORPO", allowed: ["src/a.js"], branch: "ep14/99.01-x" });
  assert.match(text, /não faça commit/i);
  assert.match(text, /- src\/a\.js/);
  assert.match(text, /CORPO/);
});

test("runPackage recusa modelo pago sem --allow-paid e modelo malformado", () => {
  assert.throws(() => runPackage(REAL_ROOT, { id: "14.03", model: "openrouter/x/y" }), /gratuito/);
  assert.throws(() => runPackage(REAL_ROOT, { id: "14.03", model: "ruim; rm" }), /inválido/);
});

test("runPackage em dry-run cria worktree/branch e não chama o opencode; verify aponta violação", () => {
  const { root, sh } = tempRepo();
  const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-pkg-wt-"));
  process.env.HARNESS_PACKAGE_DIR = pkgDir;
  try {
    let called = false;
    const report = runPackage(root, { id: "99.01", dryRun: true }, { spawn: /** @type {any} */ (() => { called = true; return { status: 0, stdout: "" }; }) });
    assert.equal(called, false);
    assert.equal(report.ok, true);
    assert.equal(report.branch, "ep14/99.01-historia");
    assert.ok(fs.existsSync(path.join(String(report.dir), "README.md")));
    assert.ok(fs.existsSync(`${report.dir}.report.json`));

    fs.mkdirSync(path.join(String(report.dir), "src"), { recursive: true });
    fs.writeFileSync(path.join(String(report.dir), "src", "a.js"), "ok");
    fs.writeFileSync(path.join(String(report.dir), "fora.js"), "x");
    const v = verifyStory(root, "99.01");
    assert.deepEqual(v.violations, ["fora.js"]);
    assert.ok(v.changed.includes("src/a.js"));
    assert.throws(() => runPackage(root, { id: "99.01", dryRun: true }), /já existe/);
  } finally {
    delete process.env.HARNESS_PACKAGE_DIR;
    sh("worktree", "prune");
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(pkgDir, { recursive: true, force: true });
  }
});

test("runPackage executa o opencode com OPENCODE_CONFIG fora do worktree e falha se o agente escapar da lista", () => {
  const { root, sh } = tempRepo();
  const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-pkg-wt-"));
  process.env.HARNESS_PACKAGE_DIR = pkgDir;
  process.env.OPENCODE_BIN = process.execPath;
  try {
    const fake = /** @type {any} */ ((_bin, _args, o) => {
      assert.ok(o.env.OPENCODE_CONFIG && !o.env.OPENCODE_CONFIG.startsWith(o.cwd));
      fs.writeFileSync(path.join(o.cwd, "intruso.txt"), "x");
      return { status: 0, stdout: JSON.stringify({ part: { type: "text", text: "feito" } }) };
    });
    const report = runPackage(root, { id: "99.01" }, { spawn: fake });
    assert.equal(report.ok, false);
    assert.deepEqual(report.violations, ["intruso.txt"]);
    assert.equal(report.summary, "feito");
  } finally {
    delete process.env.HARNESS_PACKAGE_DIR;
    delete process.env.OPENCODE_BIN;
    sh("worktree", "prune");
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(pkgDir, { recursive: true, force: true });
  }
});

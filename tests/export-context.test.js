// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { run } = require("../tools/export-context");
const { ROOT } = require("../tools/lib/root");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "export-context-test-"));
  const options = {
    claudeProjectsDir: path.join(base, "claude", "projects"),
    geminiHome: path.join(base, "gemini"),
  };
  const logs = [];
  const io = { log: (m) => logs.push(String(m)) };
  return { base, options, io, logs };
}

test("export: grava só nos diretórios injetados e não contém texto de extraido-*.md", () => {
  const { base, options, io, logs } = setup();
  // Pasta do Claude existente com conteúdo do próprio Claude Code.
  const memDir = path.join(options.claudeProjectsDir, "c--Users-matheuss-rodrigues-git-DAI", "memory");
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, "MEMORY.md"), "- fato do Claude\n");

  run(["--project", "dai"], io, options);

  const files = walk(base);
  assert.ok(files.length > 0);
  assert.ok(files.every((f) => f.startsWith(base)));
  assert.equal(fs.readFileSync(path.join(memDir, "MEMORY.md"), "utf8").startsWith("- fato do Claude\n"), true);

  // Nenhum arquivo gerado pode conter trechos de context/extraido-*.md.
  const ctxDir = path.join(ROOT, "projects", "dai", "context");
  const snippets = fs.existsSync(ctxDir)
    ? fs.readdirSync(ctxDir).filter((f) => f.startsWith("extraido-")).flatMap((f) =>
        fs.readFileSync(path.join(ctxDir, f), "utf8").split("\n").map((l) => l.trim()).filter((l) => l.length > 60))
    : [];
  const memory = fs.existsSync(path.join(ROOT, "projects", "dai", "memory.md"))
    ? fs.readFileSync(path.join(ROOT, "projects", "dai", "memory.md"), "utf8") : "";
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const s of snippets) {
      if (memory.includes(s)) continue; // linha também presente na memória curada
      assert.ok(!text.includes(s), `${f} contém texto de extraido-*.md`);
    }
  }
  assert.ok(!logs.some((l) => /[\u{1F300}-\u{1FAFF}✀-➿]/u.test(l)), "log sem emoji");
});

test("export: não gera arquivos legados e o Knowledge Item lista só memory.md", () => {
  const { base, options, io } = setup();
  run(["--project", "dai"], io, options);
  const names = walk(base).map((f) => path.basename(f));
  for (const legacy of ["regras.md", "conversas-indice.md", "regras-e-diretrizes.md", "historico-conversas.md", "memorias-consolidadas.md"]) {
    assert.ok(!names.includes(legacy), legacy);
  }
  const meta = walk(base).find((f) => f.endsWith("metadata.json"));
  assert.deepEqual(JSON.parse(fs.readFileSync(String(meta), "utf8")).artifacts, ["artifacts/memory.md"]);
});

test("export: duas execuções seguidas são idempotentes para o MEMORY.md", () => {
  const { options, io } = setup();
  const memDir = path.join(options.claudeProjectsDir, "c--Users-matheuss-rodrigues-git-DAI", "memory");
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, "MEMORY.md"), "- linha preservada\n");
  run(["--project", "dai"], io, options);
  const first = fs.readFileSync(path.join(memDir, "MEMORY.md"), "utf8");
  run(["--project", "dai"], io, options);
  assert.equal(fs.readFileSync(path.join(memDir, "MEMORY.md"), "utf8"), first);
  assert.ok(first.startsWith("- linha preservada\n"));
});

test("export: --dry-run não grava e --prune sem --yes só lista", () => {
  const { base, options, io, logs } = setup();
  const memDir = path.join(options.claudeProjectsDir, "c--Users-matheuss-rodrigues-git-DAI", "memory");
  fs.mkdirSync(memDir, { recursive: true });
  const old = path.join(memDir, "regras-e-diretrizes.md");
  fs.writeFileSync(old, "antigo");
  run(["--project", "dai", "--dry-run", "--report"], io, options);
  assert.deepEqual(walk(base), [old]);
  run(["--project", "dai", "--prune"], io, options);
  assert.ok(fs.existsSync(old));
  assert.ok(logs.some((l) => l.includes(old)));
});

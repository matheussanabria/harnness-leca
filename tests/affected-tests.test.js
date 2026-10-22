// Regressao do EP-14.02: selecao de testes afetados e check restrito aos arquivos staged.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CONTRACT_TESTS, affectedTests, isDocsOnly, nameMatches } = require("../scripts/lib/affected-tests");
const { checkStaged } = require("../scripts/pre-commit");

const ROOT = path.resolve(__dirname, "..");

test("convencao de nome ignora hifen e ponto entre arquivo e teste", () => {
  assert.equal(nameMatches("scripts/pre-commit.js", "tests/precommit.test.js"), true);
  assert.equal(nameMatches("ui/server/services/project.service.js", "tests/project-service.test.js"), true);
  assert.equal(nameMatches("tools/lib/redact.js", "tests/precommit.test.js"), false);
});

test("commit so de documentacao pula os testes", () => {
  assert.equal(isDocsOnly(["README.md", "docs/harness-evolution/02-epics/x.md"]), true);
  assert.equal(isDocsOnly(["docs/guia.js"]), true);
  assert.equal(isDocsOnly(["README.md", "scripts/pre-commit.js"]), false);
  assert.equal(isDocsOnly([]), false);
});

test("mapeia por convencao de nome, por require direto e inclui o proprio teste", () => {
  const testFiles = ["tests/precommit.test.js", "tests/engines.test.js"];
  const semImport = () => "";

  const porNome = affectedTests(["scripts/pre-commit.js"], { root: ROOT, testFiles, readFile: semImport });
  assert.deepEqual(porNome.tests, ["tests/precommit.test.js"]);
  assert.deepEqual(porNome.unmatched, []);

  const porRequire = affectedTests(["tools/lib/redact.js"], { root: ROOT, testFiles });
  assert.ok(porRequire.tests.includes("tests/precommit.test.js"));

  const proprio = affectedTests(["tests/novo.test.js"], {
    root: ROOT,
    testFiles: ["tests/novo.test.js"],
    readFile: semImport,
  });
  assert.deepEqual(proprio.tests, ["tests/novo.test.js"]);
});

test("mapeia import direto com caminho relativo", () => {
  const readFile = () => 'import { x } from "../scripts/pre-commit";';
  const result = affectedTests(["scripts/pre-commit.js"], {
    root: ROOT,
    testFiles: ["tests/usa-import.test.js"],
    readFile,
  });
  assert.deepEqual(result.tests, ["tests/usa-import.test.js"]);
  assert.deepEqual(result.unmatched, []);
});

test("arquivo sem mapa roda o contrato fixo e e reportado", () => {
  const result = affectedTests(["tools/lib/modulo-sem-teste.js"], {
    root: ROOT,
    testFiles: ["tests/precommit.test.js"],
    readFile: () => "",
  });
  assert.deepEqual(result.unmatched, ["tools/lib/modulo-sem-teste.js"]);
  assert.equal(result.contract, true);
  for (const file of CONTRACT_TESTS) assert.ok(result.tests.includes(file));
});

test("documentacao sozinha nao seleciona nenhum teste", () => {
  const result = affectedTests(["README.md", "docs/a.md"], {
    root: ROOT,
    testFiles: ["tests/precommit.test.js"],
  });
  assert.equal(result.docsOnly, true);
  assert.deepEqual(result.tests, []);
});

test("check dos staged ignora arquivos que nao foram informados", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-affected-"));
  try {
    fs.writeFileSync(path.join(dir, "ok.js"), "const a = 1;\n");
    fs.writeFileSync(path.join(dir, "ruim.js"), "const = ;\n");
    fs.writeFileSync(path.join(dir, "ok.json"), '{"a":1}');
    fs.writeFileSync(path.join(dir, "ruim.json"), "{a:1}");
    fs.writeFileSync(path.join(dir, "fora.js"), "const = ;\n");

    const problems = checkStaged(dir, ["ok.js", "ruim.js", "ok.json", "ruim.json"]);
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => p.startsWith("ruim.js")));
    assert.ok(problems.some((p) => p.startsWith("ruim.json")));
    assert.ok(!problems.some((p) => p.startsWith("fora.js")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pre-push roda a suite completa", () => {
  const text = fs.readFileSync(path.join(ROOT, ".githooks", "pre-push"), "utf8");
  assert.match(text, /node .*--test/);
  assert.match(text, /tests\/\*\.test\.js/);
});

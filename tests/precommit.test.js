// Regras do pre-commit (scripts/pre-commit.js) e do findSecrets, sem precisar de um repositório git.
const test = require("node:test");
const assert = require("node:assert/strict");

const { forbiddenPath, addedLines, scanDiff } = require("../scripts/pre-commit");
const { findSecrets } = require("../tools/lib/redact");

// Valores montados na hora: o repositório não guarda nada com cara de chave real.
const fill = (n) => "a1B2c3D4".repeat(Math.ceil(n / 8)).slice(0, n);
const apiKey = "sk-" + "ant-" + fill(30);
const ghToken = "ghp_" + fill(36);

test("forbiddenPath: dados locais barrados, template e exemplos liberados", () => {
  for (const bad of ["projects/dai/memory.md", "projects/.active", "projects\\57multimarcas\\chats\\a.md", "global/instructions.md",
    "global/memory.md", "global/.env", ".env", "ui/.env.local", "bridge/gemini-inbox.jsonl"]) {
    assert.ok(forbiddenPath(bad), `devia barrar: ${bad}`);
  }
  for (const ok of ["projects/_template/instructions.md", "projects/_template/chats/.gitkeep", "global/.env.example", "global/instructions.example.md",
    "tools/lib/env.js", "tests/golden/claude-code.txt", "README.md", "SETUP.md"]) {
    assert.equal(forbiddenPath(ok), null, `devia liberar: ${ok}`);
  }
});

test("findSecrets: acha formatos conhecidos, ignora código comum e a marca allow-secret, e não devolve o valor", () => {
  const text = [
    `const a = "${apiKey}";`,               // 1: chave
    "const token = someVariable;",          // 2: atribuição genérica: não é varrida (falso positivo em código)
    `const b = "${ghToken}"; // allow-secret`, // 3: exemplo marcado
    "-----BEGIN RSA PRIVATE KEY-----",      // 4: chave privada // allow-secret
    "https://user:senha123@host.com/x",     // 5: senha em URL // allow-secret
    "nada demais aqui",
  ].join("\n");
  const found = findSecrets(text);
  assert.deepEqual(found.map((f) => [f.line, f.rule]), [[1, "chave de API"], [4, "chave privada"], [5, "senha em URL"]]);
  assert.ok(!JSON.stringify(found).includes(apiKey), "o resultado nunca contém o segredo");
});

test("addedLines/scanDiff: só linhas adicionadas, com o número da linha no arquivo novo", () => {
  const diff = [
    "diff --git a/src/a.js b/src/a.js",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -10,0 +11,2 @@ function x() {",
    "+const ok = 1;",
    `+const k = "${apiKey}";`,
    "@@ -30 +32 @@",
    `-const velho = "${ghToken}";`,        // removido: não conta
    "+const novo = 2;",
    "diff --git a/b.md b/b.md",
    "--- /dev/null",
    "+++ b/b.md",
    "@@ -0,0 +1 @@",
    `+aqui: ${ghToken}`,
  ].join("\n");

  assert.deepEqual(addedLines(diff).map((l) => [l.file, l.line]), [["src/a.js", 11], ["src/a.js", 12], ["src/a.js", 32], ["b.md", 1]]);
  assert.deepEqual(scanDiff(diff), [
    { file: "src/a.js", line: 12, rule: "chave de API" },
    { file: "b.md", line: 1, rule: "chave de API" },
  ]);
  assert.deepEqual(scanDiff("diff --git a/x b/x\n--- a/x\n+++ /dev/null\n@@ -1 +0,0 @@\n-" + apiKey), [], "arquivo apagado não é varrido");
});

test("o próprio repositório passa na varredura de segredos (código e testes não têm chave real)", () => {
  const { spawnSync } = require("child_process");
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "tools", "tests", "ui", "scripts", "*.md", "*.json", ".github"], { encoding: "utf8" });
  if (r.status !== 0) return; // fora de um repositório git (ex.: cópia sem .git): nada a varrer
  const fs = require("fs");
  const hits = [];
  for (const rel of r.stdout.split("\0").filter(Boolean)) {
    if (rel.startsWith("tests/golden/")) continue; // saída esperada dos importadores: já redigida
    let text;
    try { text = fs.readFileSync(rel, "utf8"); } catch { continue; }
    for (const h of findSecrets(text)) hits.push(`${rel}:${h.line} (${h.rule})`);
  }
  assert.deepEqual(hits, [], "acrescente allow-secret num comentário das linhas que são exemplos");
});

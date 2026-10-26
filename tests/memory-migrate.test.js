const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { similarity, isSimilar } = require("../tools/lib/memory/dedupe");
const { inferType, parseBullets, deduplicateBullets } = require("../tools/lib/memory/migrate");
const { runMigrate } = require("../tools/memory");

test("dedupe calcula similaridade correta e reconhece duplicatas", () => {
  const frase1 = "O usuário prefere respostas curtas e objetivas";
  const frase2 = "Usuário prefere respostas curtas e objetivas.";
  const diferente = "Configurar porta do servidor para 4321 no ambiente local";

  assert.ok(similarity(frase1, frase2) > 0.85);
  assert.equal(isSimilar(frase1, frase2), true);
  assert.ok(similarity(frase1, diferente) < 0.3);
  assert.equal(isSimilar(frase1, diferente), false);
});

test("inferType classifica corretamente por padrões de texto", () => {
  assert.equal(inferType("O usuário prefere sempre o modo escuro"), "feedback");
  assert.equal(inferType("Não remover arquivos sem confirmação prévia"), "feedback");
  assert.equal(inferType("Documentação da API disponível em http://localhost:4321/api"), "reference");
  assert.equal(inferType("Decisão de arquitetura sobre os épicos do projeto"), "project");
});

test("deduplicateBullets agrupa duplicatas preservando created mais antigo e updated mais novo", () => {
  const bullets = [
    { date: "2026-03-01", text: "O usuário prefere respostas em português" },
    { date: "2026-04-15", text: "Usuário prefere respostas em português." },
    { date: "2026-05-10", text: "Decisão de criar o módulo de testes unitários" },
  ];

  const deduped = deduplicateBullets(bullets);
  assert.equal(deduped.length, 2);

  const pref = deduped.find((d) => d.type === "feedback");
  assert.ok(pref);
  assert.equal(pref.created, "2026-03-01");
  assert.equal(pref.updated, "2026-04-15");
  assert.equal(pref.duplicatesCount, 1);
});

test("runMigrate em modo dry-run não grava nada no disco", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-migrate-test-"));
  const projDir = path.join(dir, "projects", "demo");
  fs.mkdirSync(projDir, { recursive: true });

  const legacyPath = path.join(projDir, "memory.md");
  fs.writeFileSync(legacyPath, "- [2026-10-01] O usuário prefere typescript estrito\n", "utf8");

  const io = { log: () => {}, error: () => {} };
  try {
    runMigrate(["--project", "demo", "--dry-run"], io, dir);
    assert.equal(fs.existsSync(path.join(projDir, "memory")), false);
    assert.equal(fs.existsSync(path.join(projDir, "memory.legacy.md")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runMigrate grava itens, cria backup legacy e gera o índice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-migrate-test-real-"));
  const projDir = path.join(dir, "projects", "demo");
  fs.mkdirSync(projDir, { recursive: true });

  const legacyPath = path.join(projDir, "memory.md");
  fs.writeFileSync(
    legacyPath,
    "# Memória\n\n- [2026-10-01] Usuário prefere testes com node nativo\n- [2026-10-05] Decisão de refatorar o módulo de som\n",
    "utf8"
  );

  const io = { log: () => {}, error: () => {} };
  try {
    runMigrate(["--project", "demo"], io, dir);

    // Confere backup
    assert.ok(fs.existsSync(path.join(projDir, "memory.legacy.md")));
    // Confere itens criados
    const memDir = path.join(projDir, "memory");
    assert.ok(fs.existsSync(memDir));

    // Confere novo memory.md gerado como índice
    const indexContent = fs.readFileSync(path.join(projDir, "memory.md"), "utf8");
    assert.ok(indexContent.includes("Gerado por tools/memory.js index"));
    assert.ok(indexContent.includes("memory/feedback/"));
    assert.ok(indexContent.includes("memory/project/"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

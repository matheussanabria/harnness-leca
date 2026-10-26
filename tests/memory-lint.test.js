// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  checkContractErrors,
  checkGuardViolations,
  checkDuplicates,
  checkDeadPaths,
  checkBrokenWikilinks,
  checkStaleItems,
  checkIndexCapacity,
  lintScope,
  formatReport,
} = require("../tools/lib/memory/lint");
const { runLint } = require("../tools/lib/memory/run-lint");
const { serializeItem } = require("../tools/lib/memory/item");

function createTempWorkspace() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-lint-test-"));
  fs.mkdirSync(path.join(tmp, "projects", "proj1", "memory", "user"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "projects", "proj1", "memory", "project"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "tools"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "tools", "real-tool.js"), "// ok");
  return tmp;
}

test("checkContractErrors: detecta itens com erros de frontmatter ou formato", () => {
  const invalid = [
    {
      file: "dummy.md",
      relPath: "user/bad.md",
      errors: [{ campo: "name", mensagem: "nome inválido" }],
    },
  ];
  const findings = checkContractErrors(invalid);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].regra, "contrato");
  assert.equal(findings[0].severidade, "erro");
});

test("checkGuardViolations: detecta segredos e CPF no corpo ou descrição", () => {
  const valid = [
    {
      file: "sec.md",
      relPath: "project/sec.md",
      item: {
        meta: {
          name: "sec",
          description: "Segredo com token: ghp_123456789012345678901234567890123456", // allow-secret: teste de validação de token
          type: /** @type {const} */ ("project"),
          created: "2026-10-26",
          updated: "2026-10-26",
          source: "user",
        },
        body: "Senha segura: password = admin123",
      },
    },
  ];
  const findings = checkGuardViolations(valid);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].regra, "guard");
  assert.equal(findings[0].severidade, "erro");
});

test("checkDuplicates: detecta duplicatas exatas por hash e similares > 0.8", () => {
  const valid = [
    {
      file: "a.md",
      relPath: "user/a.md",
      item: {
        meta: {
          name: "a",
          description: "Prefere sempre respostas curtas e objetivas em português",
          type: /** @type {const} */ ("user"),
          created: "2026-10-26",
          updated: "2026-10-26",
          source: "user",
        },
        body: "corpo a",
      },
    },
    {
      file: "b.md",
      relPath: "user/b.md",
      item: {
        meta: {
          name: "b",
          description: "Prefere respostas curtas e objetivas em português",
          type: /** @type {const} */ ("user"),
          created: "2026-10-26",
          updated: "2026-10-26",
          source: "user",
        },
        body: "corpo b",
      },
    },
  ];
  const findings = checkDuplicates(valid);
  const provavel = findings.find((f) => f.regra === "duplicata-provavel");
  assert.ok(provavel, "deve detectar similaridade acima de 80%");
  assert.equal(provavel.severidade, "aviso");
});

test("checkDeadPaths: detecta caminhos tools/ ou docs/ inexistentes", () => {
  const tmp = createTempWorkspace();
  const valid = [
    {
      file: "item.md",
      relPath: "project/item.md",
      item: {
        meta: {
          name: "item",
          description: "Usa tools/real-tool.js e tools/inexistente-xyz.js",
          type: /** @type {const} */ ("project"),
          created: "2026-10-26",
          updated: "2026-10-26",
          source: "user",
        },
        body: "Mais detalhes em docs/nao-existe.md",
      },
    },
  ];
  const findings = checkDeadPaths(valid, tmp);
  assert.equal(findings.length, 2);
  assert.ok(findings.some((f) => f.mensagem.includes("tools/inexistente-xyz.js")));
  assert.ok(findings.some((f) => f.mensagem.includes("docs/nao-existe.md")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("checkBrokenWikilinks: detecta links para memórias que não existem", () => {
  const valid = [
    {
      file: "link.md",
      relPath: "project/link.md",
      item: {
        meta: {
          name: "link",
          description: "Depende de [[memoria-inexistente]] e [[link]]",
          type: /** @type {const} */ ("project"),
          created: "2026-10-26",
          updated: "2026-10-26",
          source: "user",
        },
        body: "",
      },
    },
  ];
  const findings = checkBrokenWikilinks(valid);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].regra, "wikilink-orfao");
  assert.ok(findings[0].mensagem.includes("memoria-inexistente"));
});

test("checkStaleItems: detecta itens project sem atualização há mais de 60 dias", () => {
  const valid = [
    {
      file: "antigo.md",
      relPath: "project/antigo.md",
      item: {
        meta: {
          name: "antigo",
          description: "Fato de arquitetura antigo",
          type: /** @type {const} */ ("project"),
          created: "2026-01-01",
          updated: "2026-01-10",
          source: "user",
        },
        body: "",
      },
    },
  ];
  const findings = checkStaleItems(valid, "2026-10-26");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].regra, "item-antigo");
  assert.ok(findings[0].mensagem.includes("mais de 60 dias"));
});

test("lintScope e runLint: gera relatório Markdown e não altera memory/", () => {
  const tmp = createTempWorkspace();
  const memDir = path.join(tmp, "projects", "proj1", "memory", "user");
  const itemContent = serializeItem(
    {
      name: "preferencia",
      description: "Prefere commits atômicos",
      type: "user",
      created: "2026-10-26",
      updated: "2026-10-26",
      source: "user",
    },
    "Corpo de teste"
  );
  const itemPath = path.join(memDir, "preferencia.md");
  fs.writeFileSync(itemPath, itemContent, "utf8");
  const statBefore = fs.statSync(itemPath);

  const logs = [];
  runLint(["--project", "proj1"], { log: (m) => logs.push(m), error: () => {} }, tmp);

  // Garante que memory/ não foi modificado
  const statAfter = fs.statSync(itemPath);
  assert.equal(statBefore.mtimeMs, statAfter.mtimeMs, "arquivo de memória deve ficar intacto");

  // Garante que o relatório foi gravado em context/faxina-memoria.md
  const reportPath = path.join(tmp, "projects", "proj1", "context", "faxina-memoria.md");
  assert.ok(fs.existsSync(reportPath), "deve gerar context/faxina-memoria.md");
  const reportText = fs.readFileSync(reportPath, "utf8");
  assert.ok(reportText.includes("# Relatório de Faxina de Memória: proj1"));

  fs.rmSync(tmp, { recursive: true, force: true });
});

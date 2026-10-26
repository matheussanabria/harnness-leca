// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");

const { extractOutsideManagedBlock, harvestClaudeDir } = require("../tools/lib/memory/harvest/claude");
const { extractGeminiMemories, harvestGeminiFile } = require("../tools/lib/memory/harvest/gemini");
const { harvestAll } = require("../tools/lib/memory/harvest/index");

test("harvest/claude: extrai bullets fora do bloco gerenciado em MEMORY.md", () => {
  const content = `# Memória do Claude
- fato nativo 1
<!-- harness:begin -->
A memória gerenciada pelo harness fica aqui
<!-- harness:end -->
- fato nativo 2
`;
  const extracted = extractOutsideManagedBlock(content);
  assert.deepEqual(extracted, ["fato nativo 1", "fato nativo 2"]);
});

test("harvest/claude: ignora arquivos com <!-- harness:generated -->", () => {
  const tempDir = makeTempDir("claude-harvest-test-", test);
  const memDir = path.join(tempDir, "memory");
  fs.mkdirSync(memDir, { recursive: true });

  fs.writeFileSync(path.join(memDir, "gerado.md"), "<!-- harness:generated -->\n# Arquivo do harness\n");
  fs.writeFileSync(
    path.join(memDir, "nativo.md"),
    "---\nname: nativo\ndescription: regra nativa do claude\n---\nCorpo da regra.\n"
  );

  const results = harvestClaudeDir(tempDir);
  assert.equal(results.length, 1);
  assert.equal(results[0].texto, "regra nativa do claude");
  assert.equal(results[0].origem, "harvest:claude:nativo.md");
});

test("harvest/gemini: extrai bullets de ## Gemini Added Memories", () => {
  const content = `# Regras Globais

## Gemini Added Memories
- Lembrar que o usuário prefere Node.js test runner nativo
- Manter arquivos com menos de 300 linhas

## Outra Seção
- Linha ignorada
`;
  const items = extractGeminiMemories(content);
  assert.deepEqual(items, [
    "Lembrar que o usuário prefere Node.js test runner nativo",
    "Manter arquivos com menos de 300 linhas",
  ]);
});

test("harvestAll: deduplica contra itens curados e descarta segredos", () => {
  const rootDir = makeTempDir("harvest-root-test-", test);
  process.env.HARNESS_ROOT = rootDir;
  const projDir = path.join(rootDir, "projects", "meu-projeto");
  const memDir = path.join(projDir, "memory", "feedback");
  fs.mkdirSync(memDir, { recursive: true });

  const { serializeItem } = require("../tools/lib/memory/item");
  fs.writeFileSync(
    path.join(memDir, "regra-existente.md"),
    serializeItem(
      {
        name: "regra-existente",
        description: "Regra que já foi curada",
        type: "feedback",
        created: "2026-10-26",
        updated: "2026-10-26",
        source: "user",
      },
      "**Why:**\nMotivo.\n\n**How to apply:**\nComo aplicar."
    )
  );

  // Pasta simulada do Claude Code
  const claudeBase = makeTempDir("claude-base-test-", test);
  const claudeProjDir = path.join(claudeBase, "c--Users-test-git-meu-projeto", "memory");
  fs.mkdirSync(claudeProjDir, { recursive: true });

  // 1 item já curado, 1 com segredo, 1 válido
  fs.writeFileSync(path.join(claudeProjDir, "curado.md"), "---\ndescription: Regra que já foi curada\n---\n");
  fs.writeFileSync(path.join(claudeProjDir, "segredo.md"), "---\ndescription: api_key = sk-proj-1234567890abcdef1234567890\n---\n"); // allow-secret: teste de validação de segredos
  fs.writeFileSync(path.join(claudeProjDir, "novo.md"), "---\ndescription: Nova preferência aprendida\n---\n");

  const logs = [];
  const errors = [];
  const io = { log: (m) => logs.push(m), error: (m) => errors.push(m) };

  // Salva mtime dos arquivos da pasta do Claude antes da execução (RF6)
  const mtimeBefore = fs.statSync(path.join(claudeProjDir, "novo.md")).mtimeMs;

  const results = harvestAll({
    project: "meu-projeto",
    engine: "claude",
    claudeProjectsDir: claudeBase,
    rootDir,
    io,
  });

  // Confere que apenas o item válido novo foi colhido
  assert.ok(results["meu-projeto"]);
  assert.equal(results["meu-projeto"].length, 1);
  assert.equal(results["meu-projeto"][0].texto, "Nova preferência aprendida");

  // Confere aviso de segredo emitido
  assert.ok(errors.some((e) => e.includes("Aviso de segredo descartado")));

  // Confere gravação em context/colhido-nativo.md
  const harvestedFile = path.join(projDir, "context", "colhido-nativo.md");
  assert.ok(fs.existsSync(harvestedFile));
  const fileContent = fs.readFileSync(harvestedFile, "utf8");
  assert.ok(fileContent.includes("Nova preferência aprendida"));

  // RF6: Confere que a pasta do motor NUNCA foi alterada (mtime inalterado)
  const mtimeAfter = fs.statSync(path.join(claudeProjDir, "novo.md")).mtimeMs;
  assert.equal(mtimeBefore, mtimeAfter);
});

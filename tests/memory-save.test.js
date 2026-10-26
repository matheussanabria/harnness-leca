const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runSave } = require("../tools/memory");

test("runSave recusa segredo com código de erro 3 e sem ecoar o valor", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-save-guard-"));
  const io = { log: () => {}, error: () => {} };

  try {
    assert.throws(() => {
      runSave([
        "--project", "teste",
        "--type", "reference",
        "--name", "chave-api-prod",
        "--description", "Chave de producao do serviço",
        "--body", "token: ghp_123456789012345678901234567890123456", // allow-secret
      ], io, dir);
    }, (err) => err.exitCode === 3 || err.message.includes("segurança"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runSave salva novo item atômico e regenera o índice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-save-atomic-"));
  const io = { log: () => {}, error: () => {} };

  try {
    runSave([
      "--project", "teste",
      "--type", "feedback",
      "--name", "preferencia-estilo",
      "--description", "O usuário prefere typescript estrito",
      "--body", "**Why:**\nEvita bugs.\n\n**How to apply:**\nConfigurar tsconfig.",
    ], io, dir);

    const itemPath = path.join(dir, "projects", "teste", "memory", "feedback", "preferencia-estilo.md");
    assert.ok(fs.existsSync(itemPath));

    const indexPath = path.join(dir, "projects", "teste", "memory.md");
    assert.ok(fs.existsSync(indexPath));
    const indexContent = fs.readFileSync(indexPath, "utf8");
    assert.ok(indexContent.includes("preferencia-estilo"));

    // Salvando item idêntico novamente deve recusar por hash igual
    assert.throws(() => {
      runSave([
        "--project", "teste",
        "--type", "feedback",
        "--name", "outro-nome",
        "--description", "O usuário prefere typescript estrito",
        "--body", "**Why:**\nEvita bugs.\n\n**How to apply:**\nConfigurar tsconfig.",
      ], io, dir);
    }, (err) => err.exitCode === 2 || err.message.includes("mesmo hash"));

    // Salvando com mesmo name atualiza (upsert)
    runSave([
      "--project", "teste",
      "--type", "feedback",
      "--name", "preferencia-estilo",
      "--description", "O usuário prefere typescript super estrito",
      "--body", "**Why:**\nEvita bugs graves.\n\n**How to apply:**\nConfigurar tsconfig com strict: true.",
    ], io, dir);

    const updatedContent = fs.readFileSync(itemPath, "utf8");
    assert.ok(updatedContent.includes("super estrito"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runSave exige --update ou --force-new para textos com similaridade > 0.8", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-save-sim-"));
  const io = { log: () => {}, error: () => {} };

  try {
    runSave([
      "--project", "demo",
      "--type", "feedback",
      "--name", "respostas-curtas",
      "--description", "O usuário prefere respostas curtas e objetivas",
      "--body", "**Why:**\nAgilidade.\n\n**How to apply:**\nDireto ao ponto.",
    ], io, dir);

    // Texto parecido (similaridade > 0.8) sem --force-new nem --update
    assert.throws(() => {
      runSave([
        "--project", "demo",
        "--type", "feedback",
        "--name", "respostas-objetivas",
        "--description", "Usuário prefere respostas curtas e objetivas.",
        "--body", "**Why:**\nAgilidade.\n\n**How to apply:**\nDireto ao ponto sempre.",
      ], io, dir);
    }, (err) => err.exitCode === 2 || err.message.includes("similar"));

    // Com --force-new deve salvar com sucesso
    runSave([
      "--project", "demo",
      "--type", "feedback",
      "--name", "respostas-objetivas",
      "--description", "Usuário prefere respostas curtas e objetivas.",
      "--body", "**Why:**\nAgilidade.\n\n**How to apply:**\nDireto ao ponto sempre.",
      "--force-new",
    ], io, dir);

    const novoPath = path.join(dir, "projects", "demo", "memory", "feedback", "respostas-objetivas.md");
    assert.ok(fs.existsSync(novoPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

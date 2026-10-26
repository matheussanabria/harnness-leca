const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { serializeItem } = require("../tools/lib/memory/item");
const { render, MAX_INDEX_LINES } = require("../tools/lib/memory/index");
const { listItems, resolveMemoryDir } = require("../tools/lib/memory/store");
const { main } = require("../tools/memory");

/**
 * Cria um item válido para testes.
 * @param {string} name
 * @param {"user"|"feedback"|"project"|"reference"} type
 * @param {string} [created]
 */
function makeValidItem(name, type, created = "2026-10-20") {
  const meta = {
    name,
    description: `Descricao do item ${name}`,
    type,
    created,
    updated: created,
    source: "chat:123",
  };
  let body = "";
  if (type === "feedback" || type === "project") {
    body = "**Why:**\nMotivo aqui.\n\n**How to apply:**\nAplicacao aqui.\n";
  }
  const content = serializeItem(meta, body);
  return { meta, body, content };
}

test("render é determinístico e gera o mesmo índice para a mesma entrada", () => {
  const item1 = makeValidItem("beta-feature", "project");
  const item2 = makeValidItem("alfa-feature", "project");
  const item3 = makeValidItem("user-pref", "user");

  const entries = [
    { relPath: "project/beta-feature.md", item: item1 },
    { relPath: "project/alfa-feature.md", item: item2 },
    { relPath: "user/user-pref.md", item: item3 },
  ];

  const res1 = render(entries, { today: "2026-10-25" });
  const res2 = render(entries, { today: "2026-10-25" });

  assert.equal(res1.content, res2.content);
  assert.equal(res1.overLimit, false);
  // Confere que alfa vem antes de beta (ordenação alfabética por name)
  const idxAlfa = res1.content.indexOf("alfa-feature");
  const idxBeta = res1.content.indexOf("beta-feature");
  assert.ok(idxAlfa > -1 && idxBeta > idxAlfa);
  // Confere que user vem antes de project
  const idxUser = res1.content.indexOf("## user");
  const idxProj = res1.content.indexOf("## project");
  assert.ok(idxUser < idxProj);
});

test("teto de 150 linhas acusa overLimit e devolve itens 'project' mais antigos como candidatos", () => {
  /** @type {Array<{ relPath: string, item: any }>} */
  const entries = [];
  for (let i = 1; i <= 160; i++) {
    const pad = String(i).padStart(3, "0");
    const date = i < 10 ? `2026-01-0${i}` : `2026-02-01`;
    const item = makeValidItem(`proj-${pad}`, "project", date);
    entries.push({ relPath: `project/proj-${pad}.md`, item });
  }

  const res = render(entries, { today: "2026-10-25" });
  assert.equal(res.overLimit, true);
  assert.ok(res.linesCount > MAX_INDEX_LINES);
  assert.ok(res.archiveCandidates.length > 0);
  // O mais antigo (proj-001 de 2026-01-01) deve ser o primeiro candidato
  assert.equal(res.archiveCandidates[0].name, "proj-001");
});

test("store.listItems ignora itens com contrato quebrado e os reporta", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-store-test-"));
  try {
    const pValid = path.join(dir, "valido.md");
    const pInvalid = path.join(dir, "invalido.md");

    const validItem = makeValidItem("item-valido", "user");
    fs.writeFileSync(pValid, validItem.content, "utf8");
    fs.writeFileSync(pInvalid, "Texto sem frontmatter de contrato", "utf8");

    const { valid, invalid } = listItems(dir);
    assert.equal(valid.length, 1);
    assert.equal(invalid.length, 1);
    assert.equal(valid[0].item.meta.name, "item-valido");
    assert.equal(invalid[0].relPath, "invalido.md");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI index e --check detectam drift e atualizam índice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-cli-test-"));
  const projDir = path.join(dir, "projects", "meu-projeto");
  const memDir = path.join(projDir, "memory");
  fs.mkdirSync(memDir, { recursive: true });

  const item = makeValidItem("acao-segura", "feedback");
  fs.writeFileSync(path.join(memDir, "acao-segura.md"), item.content, "utf8");

  const indexPath = path.join(projDir, "memory.md");
  const io = { log: () => {}, error: () => {} };

  try {
    // 1. Gera o índice pela primeira vez
    const { runIndex } = require("../tools/memory");
    // Salva arquivo com conteúdo defasado
    fs.writeFileSync(indexPath, "# Memoria antiga\n", "utf8");

    // --check deve falhar com drift
    assert.throws(() => {
      runIndex(["--project", "meu-projeto", "--check"], io, dir);
    }, /desatualizado/);

    // Sem --check deve atualizar com sucesso
    runIndex(["--project", "meu-projeto"], io, dir);
    const atualizado = fs.readFileSync(indexPath, "utf8");
    assert.ok(atualizado.includes("acao-segura"));

    // Agora --check deve passar sem erro
    runIndex(["--project", "meu-projeto", "--check"], io, dir);

  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

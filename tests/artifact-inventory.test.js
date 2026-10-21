// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { inventoryProjectArtifacts } = require("../ui/server/services/artifact-inventory.service");

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifacts-"));
  write(root, "design/artefato.html", "<!doctype html><html><body>Artefato</body></html>");
  write(root, "design/design.json", JSON.stringify({
    schema: 1,
    prototypes: [
      { id: "local", title: "Artefato local", file: "design/artefato.html" },
      { id: "externo", title: "Artefato externo", externalUrl: "https://example.test/artefato" },
      { id: "malicioso", title: "Tentativa", file: "../fora.html", externalUrl: "http://example.test/x" },
      { id: "ausente", title: "Arquivo ausente", file: "design/nao-existe.html" },
      { id: "atelier-a", title: "Duplicado", file: "design/prototypes/atelier-a/proto.json" },
    ],
  }, null, 2));
  write(root, "design/prototypes/atelier-a/proto.json", JSON.stringify({
    id: "atelier-a",
    title: "Fluxo editável",
    version: 2,
    screens: { home: {}, detalhe: {} },
    metadata: { sourceArtifact: "local", inspectionCopy: true },
  }, null, 2));
  write(root, "chats/2026-01-01-conversa.md", "---\ntitulo: Conversa de teste\n---\n\n# Conversa\n");
  write(root, "context/extraido-regras.md", "# Regras extraídas\n");
  write(root, "context/extraidos/documentos/2026-01-01-documento.md", "# Documento gerado\n");
  write(root, "context/extraidos/respostas/2026-01-01-resposta.md", "# Resposta longa\n");
  write(root, "artifacts/importados/nota-importada.md", "# Nota importada\n");
  return root;
}

test("artifact-inventory: descobre os sete tipos e monta resumo consistente", () => {
  const root = fixture();
  const result = inventoryProjectArtifacts(root, { slug: "teste" });

  assert.equal(result.ok, true);
  assert.equal(result.project, "teste");
  assert.equal(result.truncated, false);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.summary.total, 10);
  assert.deepEqual(result.summary.byKind, {
    prototype: 4,
    atelier: 1,
    chat: 1,
    extraction: 1,
    document: 1,
    response: 1,
    imported: 1,
  });
  assert.equal(result.summary.external, 1);
  assert.equal(result.summary.missing, 1);
  assert.equal(result.summary.invalid, 1);

  const keys = new Set(result.items.map((item) => item.key));
  assert.equal(keys.size, result.items.length);
  assert.equal(result.items.some((item) => item.key === "atelier:atelier-a" && item.screenCount === 2 && item.version === 2), true);
  assert.equal(result.items.some((item) => item.kind === "chat" && item.title === "Conversa de teste"), true);
  assert.equal(result.items.some((item) => item.kind === "extraction" && item.title === "Regras extraídas"), true);
  assert.equal(result.items.some((item) => item.kind === "imported" && item.title === "Nota importada"), true);
});

test("artifact-inventory: marca ausente, inválido e externo sem expor caminho absoluto", () => {
  const root = fixture();
  const result = inventoryProjectArtifacts(root);
  const byKey = new Map(result.items.map((item) => [item.key, item]));

  assert.equal(byKey.get("prototype:local")?.availability, "local");
  assert.equal(byKey.get("prototype:externo")?.availability, "external");
  assert.equal(byKey.get("prototype:externo")?.externalUrl, "https://example.test/artefato");
  assert.equal(byKey.get("prototype:malicioso")?.availability, "invalid");
  assert.equal(byKey.get("prototype:malicioso")?.externalUrl, "");
  assert.equal(byKey.get("prototype:ausente")?.availability, "missing");
  assert.equal(byKey.get("prototype:atelier-a"), undefined);

  for (const item of result.items) {
    assert.equal(/^[a-z]:\//i.test(item.file), false, `caminho absoluto exposto: ${item.file}`);
    assert.equal(item.file.includes(".."), false, `caminho relativo inválido: ${item.file}`);
  }
});

test("artifact-inventory: limite de itens preserva o total real", () => {
  const root = fixture();
  const result = inventoryProjectArtifacts(root, { limit: 2 });

  assert.equal(result.items.length, 2);
  assert.equal(result.summary.total, 10);
  assert.equal(result.truncated, true);
});

test("artifact-inventory: symlink não é seguido", (t) => {
  const root = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifacts-outside-"));
  write(outside, "segredo.md", "# Segredo\n");
  const linked = path.join(root, "context", "extraidos", "documentos", "link");
  try {
    fs.symlinkSync(path.join(outside, "segredo.md"), `${linked}.md`, "file");
  } catch {
    try {
      fs.symlinkSync(outside, linked, "junction");
    } catch {
      t.skip("symlink indisponível neste ambiente");
      return;
    }
  }

  const result = inventoryProjectArtifacts(root);
  assert.equal(result.items.some((item) => item.file.includes("link")), false);
});

test("artifact-inventory: projeto inexistente é rejeitado", () => {
  assert.throws(() => inventoryProjectArtifacts(path.join(os.tmpdir(), "nao-existe-artefatos")), /Projeto não encontrado/);
});

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

test("artifact-inventory: controller valida slug e projeto", async () => {
  const { apiProjectArtifacts } = require("../ui/server/controllers/artifact.controller");
  const ok = fakeRes();
  await apiProjectArtifacts({ res: ok, params: ["saude-dispensacao"] });
  const payload = JSON.parse(ok.body);
  assert.equal(ok.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(payload.summary.total > 0);
  assert.equal(payload.items.some((item) => /^[a-z]:\//i.test(item.file)), false);

  const invalid = fakeRes();
  await apiProjectArtifacts({ res: invalid, params: ["../etc"] });
  assert.equal(invalid.status, 400);

  const missing = fakeRes();
  await apiProjectArtifacts({ res: missing, params: ["projeto-que-nao-existe"] });
  assert.equal(missing.status, 404);
});

test("artifact-inventory: arquivos novos respeitam 300 linhas e não usam emojis", () => {
  const root = path.resolve(".");
  const files = [
    "ui/server/services/artifact-inventory-scan.service.js",
    "ui/server/services/artifact-inventory.service.js",
    "ui/server/controllers/artifact.controller.js",
    "ui/public/js/modules/design-artifacts.js",
    "ui/public/css/design/16-artifact-inventory.css",
    "tests/artifact-inventory.test.js",
  ];
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
  for (const rel of files) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(content.split("\n").length <= 300, `${rel} excedeu 300 linhas`);
    assert.equal(emoji.test(content), false, `${rel} contém emoji`);
  }
});

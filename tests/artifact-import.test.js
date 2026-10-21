// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { importArtifact } = require("../ui/server/services/artifact-import.service");
const { inventoryProjectArtifacts } = require("../ui/server/services/artifact-inventory.service");

function project() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifact-import-"));
}

function bodyReq(buffer, headers = {}) {
  return {
    headers: { "content-length": String(buffer.length), ...headers },
    async *[Symbol.asyncIterator]() { yield buffer; },
  };
}

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

test("artifact-import: salva arquivo e preserva a pasta informada", async () => {
  const root = project();
  const result = await importArtifact(root, {
    name: "Ata da reunião.md",
    folder: "reunioes/2026",
    req: bodyReq(Buffer.from("# Ata da reunião\n")),
  });

  assert.equal(result.ok, true);
  assert.equal(result.file, "artifacts/reunioes/2026/Ata-da-reunião.md");
  assert.equal(result.kind, "imported");
  assert.equal(fs.readFileSync(path.join(root, result.file), "utf8"), "# Ata da reunião\n");

  const inventory = inventoryProjectArtifacts(root);
  assert.equal(inventory.summary.byKind.imported, 1);
  assert.equal(inventory.items.find((item) => item.kind === "imported")?.title, "Ata da reunião");
});

test("artifact-import: não sobrescreve arquivo existente", async () => {
  const root = project();
  const first = await importArtifact(root, { name: "nota.md", req: bodyReq(Buffer.from("um")) });
  const second = await importArtifact(root, { name: "nota.md", req: bodyReq(Buffer.from("dois")) });

  assert.equal(first.file, "artifacts/nota.md");
  assert.equal(second.file, "artifacts/nota-1.md");
  assert.equal(fs.readFileSync(path.join(root, first.file), "utf8"), "um");
  assert.equal(fs.readFileSync(path.join(root, second.file), "utf8"), "dois");
});

test("artifact-import: rejeita extensão, corpo vazio, tamanho e pasta insegura", async () => {
  const root = project();

  await assert.rejects(
    importArtifact(root, { name: "script.exe", req: bodyReq(Buffer.from("x")) }),
    (err) => err.status === 415,
  );
  await assert.rejects(
    importArtifact(root, { name: "vazio.md", req: bodyReq(Buffer.alloc(0)) }),
    (err) => err.status === 400,
  );
  await assert.rejects(
    importArtifact(root, {
      name: "grande.md",
      req: bodyReq(Buffer.alloc(1), { "content-length": String(26 * 1024 * 1024) }),
    }),
    (err) => err.status === 413,
  );
  for (const folder of ["../fora", "a/../../fora", "a/b/c/d", "C:/fora"]) {
    await assert.rejects(
      importArtifact(root, { name: "nota.md", folder, req: bodyReq(Buffer.from("x")) }),
      (err) => err.status === 400,
    );
  }
});

test("artifact-import: não escreve em pasta que é symlink", async (t) => {
  const root = project();
  const artifacts = path.join(root, "artifacts");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifact-outside-"));
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(artifacts, "link"), "junction");
  } catch {
    t.skip("symlink indisponível neste ambiente");
    return;
  }

  await assert.rejects(
    importArtifact(root, { name: "nota.md", folder: "link", req: bodyReq(Buffer.from("x")) }),
    (err) => err.status === 400,
  );
  assert.equal(fs.existsSync(path.join(outside, "nota.md")), false);
});

test("artifact-import: controller grava no projeto e valida slug, projeto e nome", async () => {
  const { apiProjectArtifactsImport } = require("../ui/server/controllers/artifact-import.controller");
  const slug = `tmp-artifact-import-${process.pid}-${Date.now()}`;
  const dir = path.join(__dirname, "..", "projects", slug);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ok = fakeRes();
    await apiProjectArtifactsImport({
      req: bodyReq(Buffer.from("# Importado\n")),
      res: ok,
      params: [slug],
      url: new URL(`http://local/?name=importado.md&folder=docs`),
    });
    const payload = JSON.parse(ok.body);
    assert.equal(ok.status, 201);
    assert.equal(payload.file, "artifacts/docs/importado.md");

    const invalid = fakeRes();
    await apiProjectArtifactsImport({ req: bodyReq(Buffer.from("x")), res: invalid, params: ["../x"], url: new URL("http://local/?name=a.md") });
    assert.equal(invalid.status, 400);

    const missing = fakeRes();
    await apiProjectArtifactsImport({ req: bodyReq(Buffer.from("x")), res: missing, params: ["projeto-inexistente"], url: new URL("http://local/?name=a.md") });
    assert.equal(missing.status, 404);

    const noName = fakeRes();
    await apiProjectArtifactsImport({ req: bodyReq(Buffer.from("x")), res: noName, params: [slug], url: new URL("http://local/") });
    assert.equal(noName.status, 400);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artifact-import: router registra a rota de importação", () => {
  const { ROUTES } = require("../ui/server/router");
  const route = ROUTES.find((item) => item.method === "POST" && item.path.test("/api/project/teste/artifacts/import"));
  assert.equal(route?.handler?.name, "apiProjectArtifactsImport");
});

test("artifact-import: rota aceita binário apenas para importação", () => {
  const { postOk } = require("../ui/server/config");
  const headers = {
    host: "localhost:4321",
    origin: "http://localhost:4321",
    "content-type": "application/octet-stream",
  };
  assert.equal(postOk({ url: "/api/project/teste/artifacts/import?name=a.md", headers }), true);
  assert.equal(postOk({ url: "/api/project/teste/artifacts", headers }), false);
  assert.equal(postOk({ url: "/api/chat/upload?name=a.md", headers }), true);
});

test("artifact-import: arquivos novos respeitam 300 linhas e não usam emojis", () => {
  const root = path.resolve(".");
  const files = [
    "ui/server/services/artifact-import.service.js",
    "ui/server/controllers/artifact-import.controller.js",
    "ui/public/js/modules/design-artifacts-import.js",
    "ui/public/js/modules/design-artifacts.js",
    "ui/public/css/design/17-artifact-import.css",
    "ui/server/router.js",
    "tests/artifact-import.test.js",
  ];
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
  for (const rel of files) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(content.split("\n").length <= 300, `${rel} excedeu 300 linhas`);
    assert.equal(emoji.test(content), false, `${rel} contém emoji`);
  }
});

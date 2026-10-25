// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { makeTempDir } = require("./helpers/temp-dir");
const { importArtifact } = require("../ui/server/services/artifact-import.service");
const { inventoryProjectArtifacts } = require("../ui/server/services/artifact-inventory.service");
const {
  MANIFEST_REL,
  readManifest,
  updateArtifactAccess,
} = require("../ui/server/services/artifact-metadata.service");

const projectsRoot = makeTempDir("harness-artifact-meta-projects-", test);
process.env.HARNESS_PROJECTS_DIR = projectsRoot;
test.after(() => fs.rmSync(projectsRoot, { recursive: true, force: true }));

function project() {
  return makeTempDir("harness-artifact-meta-", test);
}

function bodyReq(buffer) {
  return {
    headers: { "content-length": String(buffer.length) },
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

function fakeReq({ local = true, body = {} } = {}) {
  const req = Readable.from([JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  return req;
}

function seededProject(slug, file = "artifacts/docs/nota.md") {
  const dir = path.join(projectsRoot, slug);
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), "# Nota\n", "utf8");
  return dir;
}

test("artifact-metadata: importação registra origem, checksum e acesso inicial", async () => {
  const root = project();
  const result = await importArtifact(root, {
    name: "Nota.md",
    folder: "docs",
    source: "folder",
    req: bodyReq(Buffer.from("# Nota\n")),
  });

  assert.equal(result.metadata.origin, "import");
  assert.equal(result.metadata.source, "folder");
  assert.equal(result.metadata.originalName, "Nota.md");
  assert.equal(result.metadata.access, "project");
  assert.equal(result.metadata.size, 7);
  assert.match(result.metadata.sha256, /^[a-f0-9]{64}$/);
  assert.ok(Date.parse(result.metadata.importedAt) > 0);

  const manifest = readManifest(root);
  assert.equal(manifest.error, "");
  assert.equal(manifest.items[result.file].source, "folder");
  assert.equal(fs.readFileSync(path.join(root, MANIFEST_REL), "utf8").includes(root), false);
  assert.equal(inventoryProjectArtifacts(root).items.some((item) => item.file.endsWith(".metadata.json")), false);
});

test("artifact-metadata: acesso local é filtrado do inventário remoto e do resumo", async () => {
  const root = project();
  const local = await importArtifact(root, { name: "local.md", req: bodyReq(Buffer.from("local")) });
  await importArtifact(root, { name: "projeto.md", req: bodyReq(Buffer.from("projeto")) });
  updateArtifactAccess(root, local.file, "local");

  const localView = inventoryProjectArtifacts(root, { includeLocal: true });
  const remoteView = inventoryProjectArtifacts(root, { includeLocal: false });
  assert.equal(localView.summary.byKind.imported, 2);
  assert.equal(localView.items.find((item) => item.file === local.file)?.access, "local");
  assert.equal(remoteView.summary.byKind.imported, 1);
  assert.equal(remoteView.items.some((item) => item.file === local.file), false);
  assert.equal(remoteView.items.find((item) => item.kind === "imported")?.access, "project");
});

test("artifact-metadata: arquivo antigo continua visível e recebe metadados ao restringir", () => {
  const root = project();
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts", "legado.md"), "# Legado\n", "utf8");

  const before = inventoryProjectArtifacts(root, { includeLocal: true });
  assert.equal(before.items.find((item) => item.file === "artifacts/legado.md")?.metadata, null);

  updateArtifactAccess(root, "artifacts/legado.md", "local");
  const after = inventoryProjectArtifacts(root, { includeLocal: true });
  const item = after.items.find((entry) => entry.file === "artifacts/legado.md");
  assert.equal(item?.access, "local");
  assert.equal(item?.metadata?.origin, "existing");
  assert.equal(inventoryProjectArtifacts(root, { includeLocal: false }).items.some((entry) => entry.file === "artifacts/legado.md"), false);
});

test("artifact-metadata: rejeita acesso inválido e caminho fora de artifacts", () => {
  const root = project();
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts", "nota.md"), "x", "utf8");
  fs.mkdirSync(path.join(root, "chats"), { recursive: true });
  fs.writeFileSync(path.join(root, "chats", "conversa.md"), "x", "utf8");

  assert.throws(() => updateArtifactAccess(root, "artifacts/nota.md", "public"), (err) => err.status === 400);
  assert.throws(() => updateArtifactAccess(root, "chats/conversa.md", "local"), (err) => err.status === 400);
  assert.throws(() => updateArtifactAccess(root, "artifacts/nao-existe.md", "local"), (err) => err.status === 400);
  assert.throws(() => updateArtifactAccess(root, "../fora.md", "local"), (err) => err.status === 400);
});

test("artifact-metadata: manifesto inválido gera aviso e impede importação órfã", async () => {
  const root = project();
  await importArtifact(root, { name: "primeiro.md", req: bodyReq(Buffer.from("um")) });
  fs.writeFileSync(path.join(root, MANIFEST_REL), "{ inválido", "utf8");

  const inventory = inventoryProjectArtifacts(root);
  assert.equal(inventory.warnings.some((warning) => /Manifesto/.test(warning)), true);
  assert.equal(inventory.items.find((item) => item.kind === "imported")?.metadata, null);

  await assert.rejects(
    importArtifact(root, { name: "segundo.md", req: bodyReq(Buffer.from("dois")) }),
    (err) => err.status === 500,
  );
  assert.equal(fs.existsSync(path.join(root, "artifacts", "segundo.md")), false);
});

test("artifact-metadata: controller de acesso só aceita loopback e altera o manifesto", async () => {
  const { apiProjectArtifactsAccess } = require("../ui/server/controllers/artifact-access.controller");
  const slug = `tmp-artifact-meta-${process.pid}-${Date.now()}`;
  const dir = seededProject(slug);
  try {
    const remote = fakeRes();
    await apiProjectArtifactsAccess({
      req: fakeReq({ local: false, body: { file: "artifacts/docs/nota.md", access: "local" } }),
      res: remote,
      params: [slug],
    });
    assert.equal(remote.status, 403);

    const local = fakeRes();
    await apiProjectArtifactsAccess({
      req: fakeReq({ local: true, body: { file: "artifacts/docs/nota.md", access: "local" } }),
      res: local,
      params: [slug],
    });
    assert.equal(local.status, 200);
    assert.equal(JSON.parse(local.body).access, "local");
    assert.equal(readManifest(dir).items["artifacts/docs/nota.md"].access, "local");

    const invalid = fakeRes();
    await apiProjectArtifactsAccess({
      req: fakeReq({ local: true, body: { file: "artifacts/docs/nota.md" } }),
      res: invalid,
      params: [slug],
    });
    assert.equal(invalid.status, 400);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artifact-metadata: inventário informa canManageAccess e oculta local remotamente", async () => {
  const { apiProjectArtifacts } = require("../ui/server/controllers/artifact.controller");
  const slug = `tmp-artifact-view-${process.pid}-${Date.now()}`;
  const dir = seededProject(slug);
  try {
    updateArtifactAccess(dir, "artifacts/docs/nota.md", "local");

    const local = fakeRes();
    await apiProjectArtifacts({ req: fakeReq({ local: true }), res: local, params: [slug] });
    const localPayload = JSON.parse(local.body);
    assert.equal(localPayload.canManageAccess, true);
    assert.equal(localPayload.items.some((item) => item.file === "artifacts/docs/nota.md"), true);

    const remote = fakeRes();
    await apiProjectArtifacts({ req: fakeReq({ local: false }), res: remote, params: [slug] });
    const remotePayload = JSON.parse(remote.body);
    assert.equal(remotePayload.canManageAccess, false);
    assert.equal(remotePayload.items.some((item) => item.file === "artifacts/docs/nota.md"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artifact-metadata: router registra a rota de acesso", () => {
  const { ROUTES } = require("../ui/server/router");
  const route = ROUTES.find((item) => item.method === "POST" && item.path.test("/api/project/teste/artifacts/access"));
  assert.equal(route?.handler?.name, "apiProjectArtifactsAccess");
});

test("artifact-metadata: arquivos novos respeitam 300 linhas e não usam emojis", () => {
  const root = path.resolve(".");
  const files = [
    "ui/server/services/artifact-metadata.service.js",
    "ui/server/controllers/artifact-access.controller.js",
    "ui/public/js/modules/design-artifacts.js",
    "ui/public/js/modules/design-artifacts-access.js",
    "ui/public/css/design/18-artifact-access.css",
    "ui/server/router.js",
    "tests/artifact-metadata.test.js",
  ];
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
  for (const rel of files) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(content.split("\n").length <= 300, `${rel} excedeu 300 linhas`);
    assert.equal(emoji.test(content), false, `${rel} contém emoji`);
  }
});

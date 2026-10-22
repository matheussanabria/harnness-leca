// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const projectsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifact-preview-projects-"));
process.env.HARNESS_PROJECTS_DIR = projectsRoot;
test.after(() => fs.rmSync(projectsRoot, { recursive: true, force: true }));
const { Readable } = require("stream");
const { MAX_TEXT_BYTES, buildArtifactPreview, readArtifactPreviewRaw } = require("../ui/server/services/artifact-preview.service");
const { updateArtifactAccess } = require("../ui/server/services/artifact-metadata.service");
const { apiProjectArtifactsPreview } = require("../ui/server/controllers/artifact-preview.controller");

function project() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-artifact-preview-"));
}

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function fakeRes() {
  return {
    status: 0,
    headers: /** @type {Record<string, any>} */ ({}),
    body: "",
    headersSent: false,
    writableEnded: false,
    setHeader(key, value) { this.headers[key] = value; },
    writeHead(code, headers = {}) {
      this.status = code;
      Object.assign(this.headers, headers);
      this.headersSent = true;
    },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq(url, { local = true } = {}) {
  const req = Readable.from([]);
  // @ts-ignore
  req.url = url;
  req.method = "GET";
  req.headers = {};
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "10.0.0.42" };
  return req;
}

test("artifact-preview: texto é lido com limite e sem caminho absoluto", () => {
  const root = project();
  try {
    writeFile(root, "chats/nota.md", "# Nota\n");
    const preview = buildArtifactPreview(root, { kind: "chat", file: "chats/nota.md" });
    assert.equal(preview.previewKind, "text");
    assert.equal(preview.access, "project");
    assert.equal(preview.metadata, null);
    assert.equal(preview.content, "# Nota\n");
    assert.equal(JSON.stringify(preview).includes(root), false);

    writeFile(root, "chats/grande.md", "a".repeat(MAX_TEXT_BYTES + 8));
    const large = buildArtifactPreview(root, { kind: "chat", file: "chats/grande.md" });
    assert.equal(large.truncated, true);
    assert.equal(Buffer.byteLength(large.content), MAX_TEXT_BYTES);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-preview: html, imagem e pdf usam leitura crua", () => {
  const root = project();
  try {
    writeFile(root, "context/extraidos/documentos/tela.html", "<h1>Tela</h1>");
    const html = buildArtifactPreview(root, { kind: "document", file: "context/extraidos/documentos/tela.html" });
    assert.equal(html.previewKind, "html");
    assert.equal(html.content, undefined);
    const rawHtml = readArtifactPreviewRaw(root, { kind: "document", file: "context/extraidos/documentos/tela.html" });
    assert.equal(rawHtml.mime, "text/html; charset=utf-8");
    assert.equal(rawHtml.body.toString(), "<h1>Tela</h1>");

    writeFile(root, "artifacts/foto.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const image = buildArtifactPreview(root, { kind: "imported", file: "artifacts/foto.png" });
    assert.equal(image.previewKind, "image");
    assert.equal(image.content, undefined);
    assert.equal(readArtifactPreviewRaw(root, { kind: "imported", file: "artifacts/foto.png" }).mime, "image/png");

    writeFile(root, "artifacts/doc.pdf", "%PDF-1.4");
    assert.equal(buildArtifactPreview(root, { kind: "imported", file: "artifacts/doc.pdf" }).previewKind, "pdf");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-preview: importado local é bloqueado fora do loopback", () => {
  const root = project();
  try {
    writeFile(root, "artifacts/privado.md", "# Privado\n");
    updateArtifactAccess(root, "artifacts/privado.md", "local");
    assert.throws(
      () => buildArtifactPreview(root, { kind: "imported", file: "artifacts/privado.md", includeLocal: false }),
      (err) => /** @type {any} */ (err).status === 404,
    );
    assert.throws(
      () => readArtifactPreviewRaw(root, { kind: "imported", file: "artifacts/privado.md", includeLocal: false }),
      (err) => /** @type {any} */ (err).status === 404,
    );
    const local = buildArtifactPreview(root, { kind: "imported", file: "artifacts/privado.md", includeLocal: true });
    assert.equal(local.access, "local");
    assert.equal(local.metadata?.access, "local");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-preview: manifesto inválido falha fechado", () => {
  const root = project();
  try {
    writeFile(root, "artifacts/nota.md", "# Nota\n");
    writeFile(root, "artifacts/.metadata.json", JSON.stringify({ version: 2, items: {} }));
    assert.throws(
      () => buildArtifactPreview(root, { kind: "imported", file: "artifacts/nota.md", includeLocal: true }),
      (err) => /** @type {any} */ (err).status === 409,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-preview: rejeita tipo divergente, travessia, oculto e symlink", (t) => {
  const root = project();
  const outside = project();
  try {
    writeFile(root, "chats/nota.md", "# Nota\n");
    assert.throws(
      () => buildArtifactPreview(root, { kind: "chat", file: "artifacts/nota.md" }),
      (err) => /** @type {any} */ (err).status === 403,
    );
    assert.throws(
      () => buildArtifactPreview(root, { kind: "chat", file: "chats/../secret.md" }),
      (err) => /** @type {any} */ (err).status === 400,
    );
    writeFile(root, "chats/.segredo.md", "# Segredo\n");
    assert.throws(
      () => buildArtifactPreview(root, { kind: "chat", file: "chats/.segredo.md" }),
      (err) => /** @type {any} */ (err).status === 400,
    );
    writeFile(outside, "segredo.md", "# Fora\n");
    try {
      fs.symlinkSync(path.join(outside, "segredo.md"), path.join(root, "chats/link.md"), "file");
    } catch {
      t.skip("symlink indisponível neste ambiente");
      return;
    }
    assert.throws(
      () => buildArtifactPreview(root, { kind: "chat", file: "chats/link.md" }),
      (err) => /** @type {any} */ (err).status === 404,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("artifact-preview: tipos sem prévia retornam aviso", () => {
  const root = project();
  try {
    writeFile(root, "artifacts/video.mp4", Buffer.from([0, 1, 2]));
    const preview = buildArtifactPreview(root, { kind: "imported", file: "artifacts/video.mp4" });
    assert.equal(preview.previewKind, "unsupported");
    assert.match(preview.reason, /não tem prévia/);
    assert.throws(
      () => readArtifactPreviewRaw(root, { kind: "imported", file: "artifacts/video.mp4" }),
      (err) => /** @type {any} */ (err).status === 400,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("artifact-preview: controller responde JSON, bytes e bloqueia local remoto", async () => {
  const slug = `preview-test-${process.pid}-${Date.now()}`;
  const projectDir = path.join(projectsRoot, slug);
  try {
    writeFile(projectDir, "context/extraidos/documentos/tela.html", "<h1>Tela</h1>");
    writeFile(projectDir, "artifacts/privado.md", "# Privado\n");
    updateArtifactAccess(projectDir, "artifacts/privado.md", "local");
    const file = encodeURIComponent("context/extraidos/documentos/tela.html");

    const jsonRes = fakeRes();
    await apiProjectArtifactsPreview({
      req: fakeReq(`/api/project/${slug}/artifacts/preview?kind=document&file=${file}`),
      res: jsonRes,
      params: [slug],
    });
    assert.equal(jsonRes.status, 200);
    const payload = JSON.parse(jsonRes.body);
    assert.equal(payload.previewKind, "html");
    assert.equal(payload.content, undefined);
    assert.match(payload.url, /raw=1/);
    assert.equal(jsonRes.body.includes(projectDir), false);

    const rawRes = fakeRes();
    await apiProjectArtifactsPreview({
      req: fakeReq(`/api/project/${slug}/artifacts/preview?kind=document&file=${file}&raw=1`),
      res: rawRes,
      params: [slug],
    });
    assert.equal(rawRes.status, 200);
    assert.equal(rawRes.headers["Content-Type"], "text/html; charset=utf-8");
    assert.equal(rawRes.headers["X-Content-Type-Options"], "nosniff");
    assert.match(rawRes.headers["Content-Security-Policy"], /sandbox/);
    assert.match(rawRes.headers["Content-Security-Policy"], /default-src 'none'/);
    assert.equal(rawRes.headers["Content-Security-Policy"].includes("allow-scripts"), false);
    assert.equal(rawRes.body.toString(), "<h1>Tela</h1>");

    const remoteRes = fakeRes();
    await apiProjectArtifactsPreview({
      req: fakeReq(`/api/project/${slug}/artifacts/preview?kind=imported&file=artifacts%2Fprivado.md`, { local: false }),
      res: remoteRes,
      params: [slug],
    });
    assert.equal(remoteRes.status, 404);

    const remoteRaw = fakeRes();
    await apiProjectArtifactsPreview({
      req: fakeReq(`/api/project/${slug}/artifacts/preview?kind=imported&file=artifacts%2Fprivado.md&raw=1`, { local: false }),
      res: remoteRaw,
      params: [slug],
    });
    assert.equal(remoteRaw.status, 404);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test("artifact-preview: rota registrada e arquivos dentro dos limites", () => {
  const { ROUTES } = require("../ui/server/router");
  const route = ROUTES.find((item) => item.method === "GET" && item.path.test("/api/project/teste/artifacts/preview"));
  assert.equal(route?.handler?.name, "apiProjectArtifactsPreview");

  const root = path.resolve(".");
  const files = [
    "ui/server/services/artifact-preview.service.js",
    "ui/server/controllers/artifact-preview.controller.js",
    "ui/server/routes/artifact.routes.js",
    "ui/public/js/modules/design-artifacts-preview.js",
    "ui/public/js/modules/design-artifacts.js",
    "ui/public/css/design/19-artifact-preview.css",
    "ui/server/router.js",
    "tests/artifact-preview.test.js",
  ];
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
  for (const rel of files) {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(content.split("\n").length <= 300, `${rel} excedeu 300 linhas`);
    assert.equal(emoji.test(content), false, `${rel} contém emoji`);
  }
});

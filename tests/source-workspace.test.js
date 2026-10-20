// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveWorkspace,
  listSourceFiles,
  readSourceFile,
  saveSourceFile,
} = require("../ui/server/services/source-workspace.service");

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "harness-source-"));
  const app = path.join(repo, "apps", "web");
  fs.mkdirSync(path.join(app, "src"), { recursive: true });
  fs.mkdirSync(path.join(app, "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(app, "src", "app.ts"), "export const value = 1;\n");
  fs.writeFileSync(path.join(app, "src", "app.html"), "<main>Olá</main>\n");
  fs.writeFileSync(path.join(app, ".env"), "TOKEN=segredo\n");
  fs.writeFileSync(path.join(app, "node_modules", "pkg", "index.js"), "ignored");
  return { repo, app };
}

test("source-workspace: lista somente fontes editáveis da aplicação", (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.repo, { recursive: true, force: true }));
  const root = resolveWorkspace(fx.repo, "apps/web");
  assert.equal(root, fx.app);
  assert.deepEqual(listSourceFiles(root).map((file) => file.path), ["src/app.html", "src/app.ts"]);
});

test("source-workspace: lê e salva com fingerprint otimista", (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.repo, { recursive: true, force: true }));
  const opened = readSourceFile(fx.app, "src/app.ts");
  const saved = saveSourceFile(fx.app, "src/app.ts", "export const value = 2;\n", opened.fingerprint);
  assert.match(saved.content, /value = 2/);
  assert.notEqual(saved.fingerprint, opened.fingerprint);
  assert.throws(
    () => saveSourceFile(fx.app, "src/app.ts", "conteúdo obsoleto", opened.fingerprint),
    (error) => error.code === "CONFLICT_409",
  );
});

test("source-workspace: bloqueia travessia, segredos e cwd externo", (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.repo, { recursive: true, force: true }));
  assert.throws(() => readSourceFile(fx.app, "../fora.ts"), /Acesso negado/);
  assert.throws(() => readSourceFile(fx.app, ".env"), /não editável/);
  assert.throws(() => resolveWorkspace(fx.repo, "../../fora"), /fora do repositório/);
});

test("source-workspace: API lista, abre e salva arquivo", async (t) => {
  const harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-source-http-"));
  const fx = fixture();
  const previousRoot = process.env.HARNESS_ROOT;
  process.env.HARNESS_ROOT = harnessRoot;
  t.after(() => {
    process.env.HARNESS_ROOT = previousRoot;
    fs.rmSync(harnessRoot, { recursive: true, force: true });
    fs.rmSync(fx.repo, { recursive: true, force: true });
  });

  const projectDir = path.join(harnessRoot, "projects", "source-demo");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "mcp.json"), JSON.stringify({ repo: fx.repo }));
  fs.writeFileSync(path.join(projectDir, "app.json"), JSON.stringify({ cwd: "apps/web" }));
  const { createServer } = require("../ui/server");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const listed = await fetch(`${base}/api/project/source-demo/source`);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).total, 2);

  const opened = await fetch(`${base}/api/project/source-demo/source/file?path=src%2Fapp.ts`);
  assert.equal(opened.status, 200);
  const file = await opened.json();
  const saved = await fetch(`${base}/api/project/source-demo/source/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ path: file.path, content: "export const value = 3;\n", fingerprint: file.fingerprint }),
  });
  assert.equal(saved.status, 200);
  assert.match(fs.readFileSync(path.join(fx.app, "src", "app.ts"), "utf8"), /value = 3/);
});

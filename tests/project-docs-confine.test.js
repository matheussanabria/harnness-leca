// @ts-check
// Path confinement of the documentation reader: only files inside doc/, with an allowed type, never a secret.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDocAccess, normalizeRel } = require("../ui/server/services/project-docs/confine");
const { parseSecretBlock } = require("../ui/server/services/project-docs/secret-rules");
const { readDocTree } = require("../ui/server/services/project-docs/tree");

function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** Repo with doc/ plus a sibling folder outside doc/ that a link tries to reach. */
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-docs-"));
  write(root, "doc/sistema/a.md", "# A");
  write(root, "doc/sistema/b.yml", "x: 1");
  write(root, "doc/imagem.png", "png");
  write(root, "doc/desenho.excalidraw", "{}");
  write(root, "doc/postman/api.postman_environment.json", "{\"token\":\"x\"}");
  write(root, "doc/postman/api.postman_collection.json", "{}");
  write(root, "doc/scrum/_jira-dis.json", "{}");
  write(root, "doc/privado/chave.json", "{}");
  write(root, "doc/.obsidian/app.json", "{}");
  write(root, "segredo/fora.md", "# fora de doc");
  write(root, ".gitignore", ["# Pessoais", "/.claude/settings.local.json", "", "# Contêm segredo (senha ou token)", "/doc/privado/*.json", "/.vscode/launch.json", "", "# Sistema", "Thumbs.db"].join("\r\n"));
  return root;
}

/** Junction (Windows) or directory symlink from doc/link to ../segredo; null when the OS refuses. */
function linkOutside(root) {
  const link = path.join(root, "doc", "link");
  try {
    fs.symlinkSync(path.join(root, "segredo"), link, process.platform === "win32" ? "junction" : "dir");
    return link;
  } catch {
    return null;
  }
}

test("normalizeRel: refuses traversal, absolute paths, encoded dots and dot folders", () => {
  for (const bad of ["../x.md", "a/../../x.md", "/etc/passwd", "C:/x.md", "c:\\x.md", "%2e%2e/x.md", "a/./b.md", "a//b.md", ".obsidian/app.json", "", "a\0.md", 42]) {
    assert.equal(normalizeRel(bad), null, String(bad));
  }
  assert.equal(normalizeRel("sistema\\a.md"), "sistema/a.md");
});

test("resolve: serves an allowed file and maps every refusal to its status", () => {
  const access = createDocAccess(makeRepo());
  const ok = access.read("sistema/a.md");
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.text, "# A");
  const status = (rel) => {
    const r = access.resolve(rel);
    return r.ok ? 200 : r.status;
  };
  assert.equal(status("../segredo/fora.md"), 400);
  assert.equal(status("%2e%2e/segredo/fora.md"), 400);
  assert.equal(status("imagem.png"), 403);
  assert.equal(status("desenho.excalidraw"), 403);
  assert.equal(status("postman/api.postman_environment.json"), 403);
  assert.equal(status("postman/api.postman_collection.json"), 403);
  assert.equal(status("scrum/_jira-dis.json"), 403);
  assert.equal(status("privado/chave.json"), 403, "the .gitignore secret block is honored");
  assert.equal(status("sistema/nao-existe.md"), 404);
  assert.equal(status("sistema"), 403, "a folder has no allowed extension");
});

test("resolve: a link inside doc/ that points outside is refused", (t) => {
  const root = makeRepo();
  if (!linkOutside(root)) return t.skip("the OS refused to create the link");
  const r = createDocAccess(root).resolve("link/fora.md");
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.status, 403);
});

test("resolve: files above 1 MB answer 413", () => {
  const root = makeRepo();
  write(root, "doc/grande.md", "x".repeat(1024 * 1024 + 1));
  const r = createDocAccess(root).resolve("grande.md");
  assert.equal(!r.ok && r.status, 413);
});

test("tree: lists only allowed files, skips links, dot folders and secrets", () => {
  const root = makeRepo();
  linkOutside(root);
  const { found, files, tree } = readDocTree(createDocAccess(root));
  assert.equal(found, true);
  assert.deepEqual(files.map((f) => f.path).sort(), ["sistema/a.md", "sistema/b.yml"]);
  assert.deepEqual(tree.map((n) => n.name), ["sistema"]);
});

test("tree: a repo without doc/ answers found=false", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-docs-empty-"));
  assert.equal(readDocTree(createDocAccess(root)).found, false);
});

test("parseSecretBlock: reads only the block whose comment mentions a secret, rewritten under doc/", () => {
  const rules = parseSecretBlock("# Contêm segredo\r\n/doc/postman/*-completa.json\r\n/.vscode/launch.json\r\nsenha.md\r\n\r\n# outros\r\n/doc/livre.md\r\n");
  const hit = (rel) => rules.some((re) => re.test(rel));
  assert.equal(hit("postman/x-completa.json"), true);
  assert.equal(hit("postman/sub/x-completa.json"), false, "a single * does not cross folders");
  assert.equal(hit("qualquer/senha.md"), true, "an unrooted name matches at any depth");
  assert.equal(hit("livre.md"), false, "patterns outside the secret block are ignored");
});

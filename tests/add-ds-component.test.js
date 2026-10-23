const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const P = require("../tools/ds-docs/component-page");
const { addComponent, validateManifest } = require("../tools/add-ds-component");

const nav = (current) => `<aside><nav><div><h2>Grupo</h2><ul><li><a href="#"${current === "a" ? ' aria-current="page"' : ""} data-action="goto:a">A</a></li><li><a href="#"${current === "b" ? ' aria-current="page"' : ""} data-action="goto:b">B</a></li></ul></div></nav></aside>`;
const page = (id, pn) => P.numberPids(`<header><b>topo</b></header><div class="dx-shell">${nav(id)}<main class="dx-main" id="main"><div class="dx-page"><h1>${id}</h1>${pn}</div></main></div>`);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ds-add-"));
  const design = path.join(root, "projects", "p", "design");
  const comp = path.join(design, "ds", "components", "foo");
  const vit = path.join(design, "prototypes", "vit");
  fs.mkdirSync(comp, { recursive: true });
  fs.mkdirSync(path.join(vit, "screens"), { recursive: true });
  const manifest = {
    id: "dis.foo", version: "1.0.0", name: "Foo", category: "layout", description: "Componente `Foo` de teste.",
    props: { size: { name: "size", type: "string", description: "Tamanho.", default: "`md`", required: false } },
    slots: {}, events: {}, tokensUsed: [], dependencies: [], usage: ["Use com `cuidado`."],
    docs: { bundle: "foo.bundle.js", demo: "foo.demo.js" },
    implementations: { vanilla: { framework: "vanilla", entryFile: "foo.html", files: ["foo.html", "foo.css", "foo.js"], styles: ["foo.css"], status: "available" } },
  };
  // O namespace e a vitrine vêm de design/ds/ds-config.json; sem ele valem os padrões (namespace "ds").
  fs.writeFileSync(path.join(design, "ds", "ds-config.json"), JSON.stringify({ schema: 1, namespace: "dis", vitrine: "vit" }));
  fs.writeFileSync(path.join(comp, "manifest.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(comp, "foo.html"), '<!-- demo -->\n<div class="dis-foo">\n  <span>oi</span>\n</div>\n');
  fs.writeFileSync(path.join(comp, "foo.css"), ".dis-foo { margin-bottom: 8px; }\n");
  fs.writeFileSync(path.join(comp, "foo.js"), "const a = 1; // x\n");
  fs.writeFileSync(path.join(comp, "foo.bundle.js"), "function Foo(p) { return h('div', null, p.children); }\n");
  fs.writeFileSync(path.join(comp, "foo.demo.js"), "return h(D.Foo, null, 'oi');\n");
  const pn = (p, n) => `<div class="dx-pn"><span>${p ? `<a href="#" data-action="goto:${p}">← ${p.toUpperCase()}</a>` : ""}</span><span>${n ? `<a href="#" data-action="goto:${n}">${n.toUpperCase()} →</a>` : ""}</span></div>`;
  fs.writeFileSync(path.join(vit, "screens", "a.html"), page("a", pn(null, "b")));
  fs.writeFileSync(path.join(vit, "screens", "b.html"), page("b", pn("a", null)));
  fs.writeFileSync(path.join(vit, "proto.json"), JSON.stringify({ id: "vit", screens: [{ id: "a", title: "A", file: "screens/a.html" }, { id: "b", title: "B", file: "screens/b.html" }] }));
  fs.writeFileSync(path.join(vit, "head.html"), '<script type="text/plain" id="ds-bundle-src">/* @ds-bundle: {"format":4,"components":[{"name":"A"}]} */\n(function () {\n  var api = { A: A };\n})();</script>\n<script type="application/json" id="ds-demos">{"prelude":"","demos":{"A":"return 1;"}}</script>');
  return { root, vit, design };
}

test("numberPids numera em sequência, preserva p-pre-N e ignora pre/script", () => {
  const html = P.numberPids('<div data-pid="p-9"><p>a</p><pre data-pid="p-pre-0"><code>&lt;b&gt;</code></pre><script>var x = "<i>";</script><span>b</span></div>');
  assert.equal(html, '<div data-pid="p-1"><p data-pid="p-2">a</p><pre data-pid="p-pre-0"><code>&lt;b&gt;</code></pre><script>var x = "<i>";</script><span data-pid="p-3">b</span></div>');
});

test("ensureNavItem é idempotente e continua a numeração de pids", () => {
  const base = page("a", "");
  const once = P.ensureNavItem(base, { slug: "novo", name: "Novo", afterSlug: "a" });
  assert.equal(P.ensureNavItem(once, { slug: "novo", name: "Novo", afterSlug: "a" }), once);
  assert.match(once, /goto:a"[^>]*>A<\/a><\/li><li data-pid="p-\d+"><a href="#" data-action="goto:novo"/);
  const pids = [...once.matchAll(/data-pid="(p-\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(pids).size, pids.length);
  assert.throws(() => P.ensureNavItem(base, { slug: "x", name: "X", afterSlug: "zzz" }), /não encontrado/);
});

test("validateManifest exige id dis.<slug>, usage e vanilla", () => {
  const { root, design } = fixture();
  const dir = path.join(design, "ds", "components", "foo");
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.deepEqual(validateManifest(m, "foo", dir), []);
  const bad = validateManifest({ ...m, id: "dis.x", usage: [], implementations: {} }, "foo", dir);
  assert.equal(bad.length, 3);
  fs.rmSync(root, { recursive: true, force: true });
});

test("addComponent publica página, menu, navegação, registry, bundle e demo", async () => {
  const { root, vit, design } = fixture();
  await addComponent({ root, project: "p", vitrine: "vit", slug: "foo", after: "a" });
  const read = (f) => fs.readFileSync(path.join(vit, f), "utf8");
  const foo = read("screens/foo.html");
  assert.match(foo, /<h1 data-pid="p-\d+">Foo<\/h1>/);
  for (const t of ["Exemplo", "Código", "Quando e como usar", "API"]) assert.match(foo, new RegExp(`<h2 data-pid="p-\\d+">${t}</h2>`));
  assert.match(foo, /<span class="tk-a">margin-bottom<\/span>: <span class="tk-n">8px<\/span>/);
  assert.match(foo, /aria-current="page" data-action="goto:foo"/);
  assert.doesNotMatch(foo, /aria-current="page" data-action="goto:a"/);
  assert.match(foo, /<code[^>]*>md<\/code>/);
  assert.match(foo, /← A<\/a>[\s\S]*B →/);
  const ids = [...foo.matchAll(/data-pid="(p-\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  // menu em todas as telas, na ordem do proto
  for (const f of ["a", "b"]) assert.match(read(`screens/${f}.html`), /goto:foo"/);
  assert.match(read("screens/a.html"), /goto:foo"[^>]*>←?\s*Foo →|Foo →/);
  assert.match(read("screens/b.html"), /← Foo/);
  assert.deepEqual(JSON.parse(read("proto.json")).screens.map((s) => s.id), ["a", "foo", "b"]);
  const head = read("head.html");
  assert.match(head, /function Foo\(p\)/);
  assert.match(head, /var api = \{ Foo: Foo,/);
  assert.deepEqual(JSON.parse(head.match(/@ds-bundle: (\{.*?\}) \*\//)[1]).components.map((c) => c.name), ["A", "Foo"]);
  assert.equal(JSON.parse(head.match(/id="ds-demos">(.*?)<\/script>/s)[1]).demos.Foo.trim(), "return h(D.Foo, null, 'oi');");
  const reg = JSON.parse(fs.readFileSync(path.join(design, "ds", "registry.json"), "utf8"));
  assert.equal(reg.components["dis.foo"].name, "Foo");
  // idempotente
  await addComponent({ root, project: "p", vitrine: "vit", slug: "foo", after: "a" });
  assert.equal(read("head.html"), head);
  assert.equal(read("screens/foo.html"), foo);
  fs.rmSync(root, { recursive: true, force: true });
});

test("sem ds-config.json o namespace padrão é ds e um manifest dis.* é recusado com a causa", async () => {
  const { root, design } = fixture();
  fs.rmSync(path.join(design, "ds", "ds-config.json"));
  await assert.rejects(
    addComponent({ root, project: "p", slug: "foo", vitrine: "vit" }),
    /id deve ser "ds\.foo"/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

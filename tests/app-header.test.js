const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pub = path.join(__dirname, "..", "ui", "public");
const pages = { "index.html": "home", "overview.html": "overview", "diario.html": "diario", "consumo.html": "consumo", "catalogo.html": "catalogo", "deploy.html": "deploy", "office.html": "office" };

test("render: one current link, all screens present", async () => {
  const { NAV_ITEMS, renderNav } = await import(require("node:url").pathToFileURL(path.join(pub, "js", "shared", "app-header.js")).href);
  const html = renderNav("diario");
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  for (const item of NAV_ITEMS) assert.ok(html.includes(`href="${item.href}"`), item.href);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(html), "no emojis");
});

for (const [file, id] of Object.entries(pages)) {
  test(`${file} uses the standard header marked ${id}`, () => {
    const html = fs.readFileSync(path.join(pub, file), "utf8");
    assert.match(html, new RegExp(`<header[^>]*data-app-header[^>]*data-current="${id}"`));
    assert.match(html, /\/css\/app-header\.css/);
    assert.match(html, /\/js\/shared\/app-header\.js/);
  });
}

test("narrow header keeps nav labels for screen readers and 44px targets", () => {
  const css = fs.readFileSync(path.join(pub, "css", "app-header.css"), "utf8");
  assert.ok(!/\.app-nav-item span\s*\{\s*display:\s*none/.test(css), "labels must not be display:none");
  assert.match(css, /min-height:\s*44px/);
});

test("no page keeps tag-level header rules that fight the shared header", () => {
  const files = ["css/overview.css", "css/components/05-modal-conectar-celular.css", "css/components/06-responsividade-menor.css"];
  for (const f of files) {
    const css = fs.readFileSync(path.join(pub, f), "utf8");
    assert.ok(!/(^|\n)\s*header\s*\{/.test(css), `${f} still styles bare header`);
  }
});

test("hamburger toggle renders with FontAwesome and no emoji", async () => {
  const { renderMenuToggle } = await import(require("node:url").pathToFileURL(path.join(pub, "js", "shared", "app-header.js")).href);
  const html = renderMenuToggle();
  assert.match(html, /fa-bars/);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(html), "no emojis");
});

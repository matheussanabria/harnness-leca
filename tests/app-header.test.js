const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pub = path.join(__dirname, "..", "ui", "public");
const pages = { "index.html": "home", "overview.html": "overview", "diario.html": "diario", "consumo.html": "consumo", "catalogo.html": "catalogo", "deploy.html": "deploy", "office.html": "office", "launcher.html": "launcher" };

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

test("phone header shows global nav labels in a horizontal scroller", () => {
  const css = fs.readFileSync(path.join(pub, "css", "app-header.css"), "utf8");
  const phoneCss = css.slice(css.indexOf("/* Phone: global navigation"), css.indexOf("/* Mobile hamburger"));
  assert.ok(!phoneCss.includes(".app-nav-item span"), "phone labels must remain visible");
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /flex-wrap:\s*nowrap/);
  assert.match(css, /flex:\s*0 0 auto/);
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

test("phone header: brand and project select reach 44px, usage tables scroll inside their block", () => {
  const css = fs.readFileSync(path.join(pub, "css", "app-header.css"), "utf8");
  assert.match(css, /\.app-header \.app-brand \{ min-height: 44px; \}/);
  assert.match(css, /\[data-slot="left"\] select \{ min-height: 44px; \}/);
  const consumo = fs.readFileSync(path.join(pub, "css", "consumo.css"), "utf8");
  assert.match(consumo, /\.usage-section\{overflow-x:auto\}/);
  assert.match(consumo, /minmax\(min\(300px,100%\),1fr\)/);
});

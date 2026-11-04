const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pub = path.join(__dirname, "..", "ui", "public");
const pages = { "index.html": "home", "overview.html": "overview", "diario.html": "diario", "consumo.html": "consumo", "deploy.html": "deploy", "office.html": "office" };

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

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-code-format.js")).href);

test("formatCss: uma declaração por linha, regras aninhadas e comentários preservados", async () => {
  const { formatCss } = await load();
  const out = formatCss("/* a */ .x { color: red; padding: 4px 8px } @media (max-width: 600px) { .x { gap: .5rem; background: url(data:image/png;base64,AAA) } }");
  assert.equal(out, [
    "/* a */",
    ".x {",
    "  color: red;",
    "  padding: 4px 8px;",
    "}",
    "",
    "@media (max-width: 600px) {",
    "  .x {",
    "    gap: .5rem;",
    "    background: url(data:image/png;base64,AAA);",
    "  }",
    "}",
  ].join("\n"));
});

test("formatCss é idempotente e aceita texto vazio", async () => {
  const { formatCss } = await load();
  const once = formatCss(".a{b:c}.d{e:f}");
  assert.equal(formatCss(once), once);
  assert.equal(formatCss(""), "");
});

test("formatHtml: indenta filhos, junta texto curto e não quebra void/self-closing", async () => {
  const { formatHtml } = await load();
  const out = formatHtml('<div class="a"><h3>Título</h3><img src="x.png"><p>um <b>dois</b></p><i class="fa"></i></div>');
  assert.equal(out, [
    '<div class="a">',
    "  <h3>Título</h3>",
    '  <img src="x.png">',
    "  <p>",
    "    um",
    "    <b>dois</b>",
    "  </p>",
    '  <i class="fa"></i>',
    "</div>",
  ].join("\n"));
});

test("formatHtml: quebra tags longas em um atributo por linha e preserva comentário", async () => {
  const { formatHtml } = await load();
  const out = formatHtml('<!-- c --><div class="ds-alert ds-alert--info" role="status" aria-live="polite">x</div>');
  const lines = out.split("\n");
  assert.equal(lines[0], "<!-- c -->");
  assert.equal(lines[1], "<div");
  assert.equal(lines[2], '  class="ds-alert ds-alert--info"');
  assert.ok(lines.some((l) => l.includes('aria-live="polite">')));
  assert.equal(lines[lines.length - 2], "  x");
  assert.equal(lines[lines.length - 1], "</div>");
});

test("formatHtml mantém o conteúdo de <pre> e <style> sem reformatar", async () => {
  const { formatHtml } = await load();
  const out = formatHtml("<div><style>.a{b:c}</style><pre>  x\n  y</pre></div>");
  assert.ok(out.includes(".a{b:c}"));
  assert.ok(out.includes("  x\n  y"));
});

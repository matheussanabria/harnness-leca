const test = require("node:test");
const assert = require("node:assert/strict");
const { splitBlocks, matchingBlocks, matchedCssText } = require("../ui/server/services/prototype-css-match.service");

const CSS = `/* comentario .ds-alert */
.ds-alert { color: red; }
.ds-alert--info { border: 1px solid blue; }
.ds-alertinha { color: pink; }
.outro .ds-alert__close { top: 0; }
@media (max-width: 600px) { .ds-alert { padding: 4px; } .x { a: b; } }
@media print { .nada { display: none; } }
.fora { color: green; }`;

test("splitBlocks separa regras e at-rules de primeiro nível e ignora comentários", () => {
  const blocks = splitBlocks(CSS);
  assert.equal(blocks.length, 7);
  assert.ok(blocks[0].startsWith(".ds-alert {"));
  assert.ok(blocks.some((b) => b.startsWith("@media (max-width")));
});

test("matchingBlocks acha só as classes pedidas, sem confundir prefixos", () => {
  const out = matchingBlocks(CSS, ["ds-alert", "ds-alert--info", "ds-alert__close"]);
  assert.ok(out.some((b) => b.includes("border: 1px solid blue")));
  assert.ok(out.some((b) => b.includes("top: 0")));
  assert.ok(out.some((b) => b.startsWith("@media (max-width")));
  assert.ok(!out.some((b) => b.includes("pink") || b.includes("green") || b.includes("nada")));
  assert.deepEqual(matchingBlocks(CSS, []), []);
});

test("matchedCssText junta arquivos com cabeçalho e ignora arquivo ausente", () => {
  const files = { "/a.css": ".ds-alert { color: red; }", "/b.css": ".outra { x: y; }" };
  const fake = { fs: { readFileSync: (f) => { if (!files[f]) throw new Error("x"); return files[f]; } } };
  const text = matchedCssText([{ label: "a.css", file: "/a.css" }, { label: "b.css", file: "/b.css" }, { label: "c.css", file: "/c.css" }], ["ds-alert"], fake);
  assert.match(text, /^\/\* a\.css \*\/\n\.ds-alert/);
  assert.ok(!text.includes("b.css"));
  assert.equal(matchedCssText([], ["ds-alert"], fake), "");
});

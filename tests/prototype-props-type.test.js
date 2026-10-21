const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const load = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-props-type-model.js")).href);

test("tipografia: família, peso e alinhamento calculados", async () => {
  const m = await load();
  assert.equal(m.firstFamily('"Open Sans", Arial, sans-serif'), "Open Sans");
  assert.equal(m.weightValue("bold"), "700");
  assert.equal(m.weightValue("550"), "600");
  assert.equal(m.weightValue(""), "400");
  assert.equal(m.alignOf("start"), "left");
  assert.equal(m.alignOf("end"), "right");
  assert.equal(m.alignOf("center"), "center");
});

test("tipografia: altura de linha e espaçamento", async () => {
  const m = await load();
  assert.equal(m.lineHeightOf("24px", "16px"), "1.5");
  assert.equal(m.lineHeightOf("normal", "16px"), "");
  assert.deepEqual(m.lineHeightPatch("1.4"), { "line-height": "1.4" });
  assert.deepEqual(m.lineHeightPatch("24"), { "line-height": "24px" });
  assert.deepEqual(m.lineHeightPatch(""), { "line-height": "" });
  assert.deepEqual(m.letterSpacingPatch("0.5"), { "letter-spacing": "0.5px" });
  assert.deepEqual(m.letterSpacingPatch("0"), { "letter-spacing": "" });
});

test("tipografia: seletor de fontes inclui tokens e mantém a atual sem gravar", async () => {
  const m = await load();
  const opts = m.fontOptions('"Roboto", sans-serif', [{ name: "--font-base", value: "'Inter', sans-serif" }]);
  assert.equal(opts[0][0], m.KEEP_FONT);
  assert.equal(opts[0][1], "Roboto");
  assert.ok(opts.some(([v]) => v === "var(--font-base)"));
  assert.equal(m.fontFamilyPatch(m.KEEP_FONT), null);
  assert.deepEqual(m.fontFamilyPatch("var(--font-base)"), { "font-family": "var(--font-base)" });
});

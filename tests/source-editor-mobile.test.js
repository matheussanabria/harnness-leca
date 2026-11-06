// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("EP-20.01: editor ocupa a tela no mobile e mantém controles acessíveis", () => {
  const css = read("ui/public/css/studio/05-source-editor.css");
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?position: fixed/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow: auto/);
});

test("EP-20.01: a barra do editor mobile permite voltar sem descartar o estado do arquivo", () => {
  const source = read("ui/public/js/modules/studio-source.js");
  assert.match(source, /class="source-mobile-back"/);
  assert.match(source, /onclick="setStudioModeType\('source'\)"/);
  assert.match(source, /id="btnStudioSourceSave"/);
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const moduleUrl = (relativePath) => pathToFileURL(path.join(__dirname, "..", relativePath)).href;

test("editor de código: realça TypeScript, HTML e CSS sem executar marcação", async () => {
  const { highlightSourceCode, sourceLanguage } = await import(moduleUrl("ui/public/js/modules/studio-source-highlight.js"));
  const ts = highlightSourceCode("import { Component } from '@angular/core'; // nota", "app.component.ts");
  assert.match(ts, /syntax-keyword[^>]*>import/);
  assert.match(ts, /syntax-type[^>]*>Component/);
  assert.match(ts, /syntax-comment[^>]*>\/\/ nota/);
  assert.equal(sourceLanguage("app.component.ts"), "TypeScript");

  const html = highlightSourceCode('<button class="primary">Salvar</button><script>x</script>', "view.html");
  assert.match(html, /syntax-tag[^>]*>button/);
  assert.match(html, /syntax-attribute[^>]*>class/);
  assert.doesNotMatch(html, /<script>/);

  const css = highlightSourceCode(".card { color: #ffcc00; padding: 12px; }", "view.css");
  assert.match(css, /syntax-property[^>]*>color/);
  assert.match(css, /syntax-color[^>]*>#ffcc00/);

  const json = highlightSourceCode('{"ativo": true, "nome": "Ana"}', "data.json");
  assert.match(json, /syntax-property[^>]*>"ativo"/);
  assert.match(json, /syntax-keyword[^>]*>true/);
});

test("editor de código: constrói hierarquia de diretórios a partir dos caminhos", async () => {
  const { buildSourceTree } = await import(moduleUrl("ui/public/js/modules/studio-source-tree.js"));
  const tree = buildSourceTree([
    { path: "src/app/features/pacientes/pacientes.component.ts", name: "pacientes.component.ts" },
    { path: "src/app/features/pacientes/pacientes.component.html", name: "pacientes.component.html" },
    { path: "src/styles.css", name: "styles.css" },
  ]);
  const src = tree.dirs.get("src");
  const app = src.dirs.get("app");
  const pacientes = app.dirs.get("features").dirs.get("pacientes");
  assert.deepEqual(pacientes.files.map((file) => file.name).sort(), ["pacientes.component.html", "pacientes.component.ts"]);
  assert.equal(src.files[0].name, "styles.css");
});

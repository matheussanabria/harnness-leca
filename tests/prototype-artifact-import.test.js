// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { artifactInspectionId, getBody, getHeadResources } = require("../ui/server/services/prototype-artifact-import.service");

test("prototype-artifact-import: prepara uma cópia de inspeção sem recursos externos", () => {
  const html = `<!doctype html><html><head>
    <script src="./vendor/app.js"></script>
    <link rel="stylesheet" href="ds/base.css">
    <script src="https://externo.test/evil.js"></script>
  </head><body><main>Conteúdo</main></body></html>`;

  assert.equal(artifactInspectionId("Dis Fluxo"), "dis-fluxo-inspecao");
  assert.equal(getBody(html), "<main>Conteúdo</main>");
  const resources = getHeadResources(html, "/api/project/saude/design/prototype/dis-fluxo");
  assert.match(resources, /\/vendor\/app\.js/);
  assert.match(resources, /\/ds\/base\.css/);
  assert.doesNotMatch(resources, /externo\.test/);
});

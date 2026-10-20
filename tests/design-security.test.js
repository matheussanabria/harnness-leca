// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { isSafeHttpsUrl, loadDesignJson } = require("../ui/server/services/design-index.service");
const { isInside } = require("../ui/server/services/design-layers.service");
const { resolvePrototypeArtifact } = require("../ui/server/services/prototype-artifact.service");

test("design-security: isSafeHttpsUrl aceita apenas https válido e rejeita javascript ou esquemas perigosos", () => {
  assert.equal(isSafeHttpsUrl("https://claude.ai/artifact/123"), true);
  assert.equal(isSafeHttpsUrl("https://exemplo.com.br/proto.html"), true);

  // Rejeições estritas de segurança
  assert.equal(isSafeHttpsUrl("http://inseguro.com"), false);
  assert.equal(isSafeHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpsUrl("data:text/html,<script>"), false);
  assert.equal(isSafeHttpsUrl("file:///C:/Windows/system32"), false);
  assert.equal(isSafeHttpsUrl(""), false);
  assert.equal(isSafeHttpsUrl(null), false);
});

test("design-security: isInside detecta corretamente tentativas de fuga por .. ou absoluto", () => {
  const root = "C:\\app\\repo";
  assert.equal(isInside(root, "C:\\app\\repo\\doc\\features"), true);
  assert.equal(isInside(root, "C:\\app\\repo\\..\\secret.txt"), false);
  assert.equal(isInside(root, "C:\\outra\\pasta"), false);
});

test("design-security: loadDesignJson sanitiza URLs e caminhos maliciosos do arquivo", () => {
  const malformedJson = JSON.stringify({
    schema: 1,
    project: "saude",
    prototypes: [
      { id: "p1", title: "Bom", externalUrl: "https://valido.com", file: "doc/proto.html" },
      { id: "p2", title: "Malicioso", externalUrl: "javascript:eval(code)", file: "../../etc/passwd" },
    ],
    components: [
      { id: "c1", dsFolder: "doc/design-system/01" },
      { id: "c2", dsFolder: "../fora/do/repo" },
    ],
  });

  const mockDeps = {
    fs: {
      existsSync: () => true,
      readFileSync: () => malformedJson,
    },
    path,
  };

  const loaded = loadDesignJson("/proj", mockDeps);
  assert.equal(loaded.prototypes[0].externalUrl, "https://valido.com");
  assert.equal(loaded.prototypes[0].file, "doc/proto.html");

  // O protótipo malicioso tem a URL externa e o arquivo anulados
  assert.equal(loaded.prototypes[1].externalUrl, null);
  assert.equal(loaded.prototypes[1].file, null);

  // Componente fora do repo tem dsFolder anulado
  assert.equal(loaded.components[0].dsFolder, "doc/design-system/01");
  assert.equal(loaded.components[1].dsFolder, null);
});

test("design-security: artefatos ficam confinados ao design do projeto", () => {
  const existing = new Set([
    path.resolve("/proj/design/flow/Main.html"),
    path.resolve("/proj/design/flow/app.js"),
  ]);
  const deps = {
    fs: {
      existsSync: (file) => existing.has(path.resolve(file)),
      statSync: () => ({ isFile: () => true, size: 10 }),
    },
    path,
  };

  const ok = resolvePrototypeArtifact("/proj", { file: "design/flow/Main.html" }, "app.js", deps);
  assert.equal(ok.ok, true);
  const escaped = resolvePrototypeArtifact("/proj", { file: "../outro/Main.html" }, "", deps);
  assert.equal(escaped.ok, false);
});

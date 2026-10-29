// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { importArtifactForInspection, artifactInspectionId } from "../ui/server/services/prototype-artifact-import.service.js";
import { renderSandboxScreen } from "../ui/server/services/prototype-sandbox-renderer.service.js";
import { tableSafeDcTemplate } from "../ui/server/services/dc-template-runtime.service.js";

const require = createRequire(import.meta.url);
const { withInitialPage } = require("../ui/server/services/prototype-sandbox-dc.service.js");

const REPO_ROOT = path.resolve(".");

const DC_SOURCE = `<!DOCTYPE html>
<html><head><script src="./support.js"></script></head>
<body>
<x-dc>
<helmet><style>body{margin:0}</style></helmet>
<div class="shell"><img src="uploads/logo.png" alt="logo"><sc-if value="{{ is.home }}"><p>Início</p></sc-if></div>
<script type="text/x-dc" data-dc-script data-props="{&quot;startScreen&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;home&quot;,&quot;estoque&quot;]}}">
class Component extends DCLogic { state = {}; }
</script>
</x-dc>
</body></html>`;

const STATIC_SOURCE = `<!DOCTYPE html><html><head><style>.a{color:red}</style></head>
<body><main><h1>Estático</h1></main></body></html>`;

test("DC table controls are encoded as parser-safe template nodes", () => {
  const source = '<tbody><sc-for list="{{ rows }}" as="r"><tr><td><sc-if value="{{ r.ok }}">{{ r.name }}</sc-if></td></tr></sc-for></tbody>';
  assert.equal(
    tableSafeDcTemplate(source),
    '<tbody><template data-dc-control="sc-for" list="{{ rows }}" as="r"><tr><td><template data-dc-control="sc-if" value="{{ r.ok }}">{{ r.name }}</template></td></tr></template></tbody>',
  );
});

test("DC documentation routing selects the requested page over persisted local state", () => {
  const logic = "state = { page: 'inicio' };\ncomponentDidMount() { try { var p = localStorage.getItem('ds2.page'); if (p) this.setState({ page: p }); } catch (e) {} }";
  const selected = withInitialPage(logic, "c-button");
  assert.match(selected, /page: 'c-button'/);
  assert.match(selected, /componentDidMount\(\) \{\}/);
  assert.doesNotMatch(selected, /localStorage\.getItem/);
});

function setupProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-pipeline-"));
  const artifactsDir = path.join(dir, "design", "artifacts");
  fs.mkdirSync(path.join(artifactsDir, "uploads"), { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, "uploads", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  fs.writeFileSync(path.join(artifactsDir, "multimarcas.dc.html"), DC_SOURCE, "utf8");
  fs.writeFileSync(path.join(artifactsDir, "estatico.html"), STATIC_SOURCE, "utf8");
  fs.mkdirSync(path.join(dir, "design", "prototypes"), { recursive: true });
  return dir;
}

test("EP-DC: importação e renderização ponta a ponta de .dc.html", async (t) => {
  const dir = setupProject();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await t.test("importa .dc.html como protótipo em partes, com formato 3 e tela padrão", () => {
    const res = importArtifactForInspection(dir, "projeto", {
      id: "multimarcas",
      title: "57Multimarcas",
      file: "design/artifacts/multimarcas.dc.html",
    });
    assert.equal(res.ok, true);
    assert.equal(res.protoId, artifactInspectionId("multimarcas"));
    assert.equal(res.changed, true);
    const proto = JSON.parse(fs.readFileSync(path.join(dir, "design", "prototypes", res.protoId, "proto.json"), "utf8"));
    assert.equal(proto.metadata.runtime, "dc");
    assert.equal(proto.metadata.inspectionFormat, 3);
    assert.deepEqual(proto.screens.map((s) => s.id), ["home", "estoque"]);
    assert.equal(proto.activeScreen, "home");
  });

  await t.test("reimportar o mesmo arquivo não altera nada", () => {
    const res = importArtifactForInspection(dir, "projeto", {
      id: "multimarcas",
      file: "design/artifacts/multimarcas.dc.html",
    });
    assert.equal(res.changed, false);
  });

  await t.test("renderiza a tela pedida com runtime local, CSP e asset embutido", () => {
    const protoId = artifactInspectionId("multimarcas");
    const res = renderSandboxScreen(dir, REPO_ROOT, protoId, "estoque");
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    const csp = res.headers["Content-Security-Policy"];
    assert.ok(csp.includes(`nonce-${res.nonce}`));
    assert.ok(!csp.includes("unpkg"));
    assert.ok(res.html.includes('data-runtime="dc"'));
    assert.ok(res.html.includes('src="/js/vendor/dc-runtime/support.js"'));
    assert.ok(res.html.includes("x-dc { display: none !important; }"));
    const reactIndex = res.html.indexOf('src="/js/vendor/dc-runtime/react.production.min.js"');
    const reactDomIndex = res.html.indexOf('src="/js/vendor/dc-runtime/react-dom.production.min.js"');
    const supportIndex = res.html.indexOf('src="/js/vendor/dc-runtime/support.js"');
    assert.ok(reactIndex > 0 && reactIndex < reactDomIndex && reactDomIndex < supportIndex);
    assert.ok(res.html.includes("window.__resources="));
    assert.ok(res.html.includes('"/js/vendor/dc-runtime/react.production.min.js"'));
    assert.ok(res.html.includes('"/js/vendor/dc-runtime/react-dom.production.min.js"'));
    const resourcesLine = /window\.__resources=(.*?);<\/script>/.exec(res.html)?.[1] || "";
    assert.ok(resourcesLine.length > 0 && !resourcesLine.includes("undefined"));
    assert.ok(res.html.includes("default&quot;:&quot;estoque"));
    assert.ok(res.html.includes("data:image/png;base64,"));
    assert.ok(res.html.includes("data-dc-tpl"));
    assert.ok(!/<script[^>]*src="https?:\/\//i.test(res.html));
  });

  await t.test("tela inexistente do protótipo DC retorna 404", () => {
    const res = renderSandboxScreen(dir, REPO_ROOT, artifactInspectionId("multimarcas"), "tela-fantasma");
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
  });

  await t.test("HTML estático continua pelo caminho antigo (screens/home.html, formato 2)", () => {
    const res = importArtifactForInspection(dir, "projeto", {
      id: "estatico",
      file: "design/artifacts/estatico.html",
    });
    assert.equal(res.ok, true);
    const proto = JSON.parse(fs.readFileSync(path.join(dir, "design", "prototypes", res.protoId, "proto.json"), "utf8"));
    assert.equal(proto.metadata.inspectionFormat, 2);
    assert.equal(proto.metadata.runtime, undefined);
    assert.ok(fs.existsSync(path.join(dir, "design", "prototypes", res.protoId, "screens", "home.html")));
    const rendered = renderSandboxScreen(dir, REPO_ROOT, res.protoId, "home");
    assert.equal(rendered.ok, true);
    assert.ok(rendered.headers["Content-Security-Policy"].includes("nonce-"));
  });
});

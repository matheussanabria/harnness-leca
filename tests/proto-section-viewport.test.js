import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { dls } from "../ui/public/js/modules/design-layers-store.js";
import { renderPrototypeFrame, FRAME_WIDTHS } from "../ui/public/js/modules/design-layers/layers-screen-replica-proto.js";

const require = createRequire(import.meta.url);
const { extractContentSection } = require("../ui/server/services/prototype-section-extract.js");
const { renderPrototypeScreen } = require("../ui/server/services/prototype-renderer.service.js");

const SCREEN = `<div class="ds dis dis-shell"><header class="ds-header">TOPO</header>
<div class="dis-shell__body"><aside class="dis-sidenav">MENU</aside>
<main class="dis-shell__content" id="c"><section>SECAO</section></main></div></div>`;

test("CP-01: recorte traz so a area de conteudo", () => {
  const out = extractContentSection(SCREEN);
  assert.match(out, /SECAO/);
  assert.ok(!out.includes("TOPO"));
  assert.ok(!out.includes("MENU"));
  assert.match(out, /dis-shell--section/);
});

test("CP-02: recorte mantem elementos main aninhados da secao", () => {
  const html = `<aside>MENU</aside><main class="x dis-shell__content"><main>INTERNO</main><p>FIM</p></main><footer>RODAPE</footer>`;
  const out = extractContentSection(html);
  assert.match(out, /INTERNO/);
  assert.match(out, /FIM/);
  assert.ok(!out.includes("RODAPE"));
});

test("CP-03: tela sem area de conteudo volta inteira", () => {
  const html = "<div>sem conteudo</div>";
  assert.equal(extractContentSection(html), html);
  assert.equal(extractContentSection('<main class="dis-shell__content">aberto'), '<main class="dis-shell__content">aberto');
});

function projectWithPrototype() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-section-"));
  const protoDir = path.join(projectDir, "design", "prototypes", "dis-paciente");
  fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ id: "dis-paciente", screens: [{ id: "historico", file: "screens/historico.html" }] }));
  fs.writeFileSync(path.join(protoDir, "screens", "historico.html"), SCREEN);
  return projectDir;
}

test("CP-04: servidor devolve a secao com part content e a tela inteira sem o parametro", () => {
  const projectDir = projectWithPrototype();
  const full = renderPrototypeScreen(projectDir, projectDir, "dis-paciente", "historico", {});
  const section = renderPrototypeScreen(projectDir, projectDir, "dis-paciente", "historico", {}, undefined, { part: "content" });
  assert.ok(full.ok && section.ok);
  assert.match(full.html, /TOPO/);
  assert.ok(!section.html.includes("TOPO"));
  assert.match(section.html, /SECAO/);
});

const sc = { title: "Historico", prototype: { id: "dis-paciente", screen: "historico" } };

test("CP-05: quadro usa a largura do modo e a URL pede a secao", () => {
  dls.activeViewport = "tablet";
  const html = renderPrototypeFrame(sc);
  assert.match(html, new RegExp(`width:${FRAME_WIDTHS.tablet}px`));
  assert.match(html, /data-frame-width="768"/);
  assert.match(html, /render\/historico\?part=content/);
});

test("CP-06: modo desconhecido usa desktop", () => {
  dls.activeViewport = "wide";
  assert.match(renderPrototypeFrame(sc), new RegExp(`data-frame-width="${FRAME_WIDTHS.desktop}"`));
  dls.activeViewport = "mobile";
  assert.match(renderPrototypeFrame(sc), /data-frame-width="390"/);
  dls.activeViewport = null;
});

test("real: secao de todas as telas do protótipo dis-paciente, quando existir", { skip: !fs.existsSync("C:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/prototypes/dis-paciente/screens") }, () => {
  const dir = "C:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/prototypes/dis-paciente/screens";
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const out = extractContentSection(fs.readFileSync(path.join(dir, file), "utf8"));
    assert.match(out, /dis-shell--section/, file);
    assert.ok(!out.includes('data-component="dis.header"'), file);
  }
});

test("o recorte mantem os scripts da tela, que ficam fora do main", () => {
  const html = `<header>TOPO</header><main class="dis-shell__content"><button id="b">x</button></main><script>window.x = 1;</script>`;
  const out = extractContentSection(html);
  assert.match(out, /<script>window\.x = 1;<\/script>/);
  assert.ok(!out.includes("TOPO"));
  const seguinte = extractContentSection('<script>a()</script><main class="dis-shell__content">c</main>');
  assert.match(seguinte, /<script>a\(\)<\/script>/);
});

test("real: toda tela do protótipo dis-paciente com script mantem o script no recorte", { skip: !fs.existsSync("C:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/prototypes/dis-paciente/screens") }, () => {
  const dir = "C:/Users/matheuss.rodrigues/git/harness-leca/projects/saude-dispensacao/design/prototypes/dis-paciente/screens";
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(dir, file), "utf8");
    const scripts = (html.match(/<script\b/gi) || []).length;
    const out = extractContentSection(html);
    assert.equal((out.match(/<script\b/gi) || []).length >= Math.min(scripts, 1), true, file);
  }
});

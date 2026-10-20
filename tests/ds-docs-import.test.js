// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const T = require("../tools/ds-docs/screen-transform.js");
const { findJsonEnd, kebab, isScreenModel, SCREEN_MODELS } = require("../tools/ds-docs/extract.js");

test("injectPids numera elementos e não toca em script/style", () => {
  const { html, count } = T.injectPids('<div class="a"><p>oi</p><script>if (a<b) { x = "<i>"; }</script></div>');
  assert.equal(count, 2);
  assert.match(html, /<div class="a" data-pid="p-1">/);
  assert.match(html, /<p data-pid="p-2">/);
  assert.ok(html.includes('if (a<b) { x = "<i>"; }'));
});

test("injectPids preserva data-pid existente", () => {
  const { html, count } = T.injectPids('<div data-pid="x"><b>t</b></div>');
  assert.equal(count, 1);
  assert.ok(html.includes('data-pid="x"'));
});

test("wireNavigation liga botões por classe e texto, sem sobrescrever data-action", () => {
  const rules = [{ cls: "nav", text: "Histórico", goto: "historico" }, { text: "Voltar", goto: "visao-geral" }];
  const out = T.wireNavigation('<a class="nav" href="#">Histórico</a><button type="button">Voltar</button><button type="button" data-action="x">Voltar</button><button type="button">Outro</button>', rules);
  assert.match(out, /<a class="nav" href="#" data-action="goto:historico">/);
  assert.match(out, /<button type="button" data-action="goto:visao-geral">Voltar/);
  assert.equal((out.match(/data-action=/g) || []).length, 3);
});

test("rewriteScript troca location.href mapeado por harnessGoto", () => {
  const js = "a.onclick = () => { location.href = '/pacientes/nova'; }; b = '/outro';";
  const out = T.rewriteScript(js, { "/pacientes/nova": "nova-prescricao" });
  assert.ok(out.includes("harnessGoto('nova-prescricao')"));
  assert.ok(out.includes("b = '/outro'"));
});

test("wrapScript isola em IIFE com try/catch", () => {
  const out = T.wrapScript("run();");
  assert.match(out, /^<script>\n\(function/);
  assert.ok(out.includes("catch (error)"));
});

test("dropBlockedImages remove imagens externas e mantém data URI", () => {
  const html = '<img src="https://x.com/a.png"><img src="data:image/png;base64,AA"><img src="//cdn/x.png">';
  const out = T.dropBlockedImages(html);
  assert.equal((out.match(/<img/g) || []).length, 1);
  assert.ok(out.includes("data:image/png"));
});

test("buildRootClassMap ignora classes ambíguas", () => {
  const map = T.buildRootClassMap([
    { id: "dis.a", html: '<div class="ds-a x">' },
    { id: "dis.b", html: '<div class="ds-b">' },
    { id: "dis.c", html: '<div class="ds-b">' },
  ]);
  assert.equal(map.get("ds-a"), "dis.a");
  assert.equal(map.has("ds-b"), false);
});

test("extract: findJsonEnd respeita strings com chaves e kebab converte nomes", () => {
  const src = '{"a":"}{","b":[1,{"c":2}]} resto';
  assert.equal(src.slice(0, findJsonEnd(src, 0) + 1), '{"a":"}{","b":[1,{"c":2}]}');
  assert.equal(kebab("PatientHeader"), "patient-header");
});

test("extract: modelos de tela têm ids únicos e isScreenModel os reconhece", () => {
  assert.equal(new Set(SCREEN_MODELS.map((m) => m.id)).size, SCREEN_MODELS.length);
  assert.ok(SCREEN_MODELS.length >= 7);
  assert.equal(isScreenModel(SCREEN_MODELS[0].doc), true);
  assert.equal(isScreenModel("Button"), false);
});

test("docs-site: gera uma tela por página, liga o menu por goto e não numera o código", () => {
  const { buildDocsSitePrototype, siteCss } = require("../tools/ds-docs/docs-site.js");
  const docs = {
    nav: [{ title: "A", items: [{ id: "inicio", title: "Início" }, { id: "statusbadge", title: "StatusBadge" }] }],
    components: { StatusBadge: { title: "StatusBadge", html: "<i></i>", css: ".a{}", js: "", react: "x", angular: "" } },
    prelude: "var h = React.createElement;", demos: { StatusBadge: "return h('b', null, 'ok');" }, bundleJs: "/* @ds-bundle */ window.DS = {};",
  };
  const site = {
    ids: ["inicio", "statusbadge"],
    styles: [":root{--a:1}\n:root{--dx-bg:#fff}.dx-top{}"],
    top: '<header class="dx-top"></header>',
    side: '<aside class="dx-side"><nav><a href="#inicio" aria-current="page">Início</a><a href="#statusbadge">StatusBadge</a></nav></aside>',
    pages: { inicio: '<div class="dx-page"><pre class="dx-pre"><code><span>a</span></code></pre></div>', statusbadge: '<div class="dx-page"><div class="dx-stage__inner ds"></div></div>' },
  };
  const files = buildDocsSitePrototype(docs, site, { protoId: "p", assets: {} }, () => []);
  const screen = files.find((f) => f.rel.endsWith("screens/status-badge.html")).content;
  assert.match(screen, /data-action="goto:inicio"/);
  assert.match(screen, /aria-current="page" data-action="goto:status-badge"/);
  assert.equal((screen.match(/aria-current/g) || []).length, 1);
  assert.match(screen, /class="dx-stage__inner ds" data-demo="StatusBadge"/);
  const head = files.find((f) => f.rel.endsWith("head.html")).content;
  assert.ok(head.includes('id="ds-bundle-src"') && head.includes('id="ds-demos"') && head.includes("HARNESS_PROTO_MODE"));
  const inicio = files.find((f) => f.rel.endsWith("screens/inicio.html")).content;
  assert.ok(inicio.includes("<span>a</span>"), "conteúdo do código intacto");
  assert.equal((inicio.match(/<span data-pid/g) || []).length, 0);
  const proto = JSON.parse(files.find((f) => f.rel.endsWith("proto.json")).content);
  assert.deepEqual(proto.screens.map((s) => s.id), ["inicio", "status-badge"]);
  assert.ok(siteCss(site.styles).startsWith("/* Site do DIS Design System"));
  assert.ok(!siteCss(site.styles).includes("--a:1"));
});

test("search-screen: tela Pesquisar paciente liga ao fluxo e traz abas, busca e tabelas", () => {
  const { buildSearchScreen, PATIENTS, SEARCH_ID, SEARCH_HEAD_SCRIPT } = require("../tools/ds-docs/search-screen");
  const overview = '<div><header class="ds-header" data-pid="p-2"><a class="ds-header__link" href="#" aria-current="page" data-action="goto:visao-geral">Pesquisar paciente</a></header></div>';
  const html = buildSearchScreen(overview);
  assert.match(html, /aria-current="page"[^>]*data-action="goto:pesquisar-paciente"|data-action="goto:pesquisar-paciente"/);
  assert.equal((html.match(/data-action="goto:visao-geral"/g) || []).length, PATIENTS.filter((p) => p.esp).length + PATIENTS.filter((p) => p.days != null).length);
  assert.equal(SEARCH_ID, "pesquisar-paciente");
  assert.ok(html.includes("data-psearch") && html.includes('data-panel="atr"') && html.includes("Medicamentos em atraso"));
  assert.ok(SEARCH_HEAD_SCRIPT.includes("data-expand-meds"));
});

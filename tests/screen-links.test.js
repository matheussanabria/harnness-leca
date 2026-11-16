// Links between Layers map screens (`navega`): adapter, both directions after the canvas merge, the strip.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { renderScreenLinks } from "../ui/public/js/modules/design-layers/layers-screen-links.js";

const require = createRequire(import.meta.url);
const { adaptFeatureScreen } = require("../ui/server/services/feature-screen-adapter.js");
const { mergeScreens } = require("../ui/server/services/project-screens-features.js");
const { linkScreens } = require("../ui/server/services/screen-links.js");

const feature = (slug) => ({ slug, featureTitle: slug });
const tela = (id, titulo, rota, navega = []) => ({ id, titulo, rota, campos: [{ id: "proximo" }, { id: "anterior" }], navega });

test("adapter: keeps valid links, drops unknown types and empty targets, via only on calls", () => {
  const sc = adaptFeatureScreen(tela("s1", "Etapa 1", "/a", [
    { tipo: "navegacao", campo: "proximo", para: "nova-s2", como: "Próximo", via: "http", evidencia: "a.html:1" },
    { tipo: "chamada", para: "apoio-s1", como: "Busca", via: "servico" },
    { tipo: "protecao", para: "x-s1", como: "não entra" },
    { tipo: "navegacao", como: "sem destino" },
    { campo: "anterior", para: "nova-s0", como: "Sem tipo: o primeiro formato" },
  ]), feature("nova"));
  assert.deepEqual(sc.navega, [
    { tipo: "navegacao", para: "nova-s2", campo: "proximo", via: "", como: "Próximo", evidencia: "a.html:1" },
    { tipo: "chamada", para: "apoio-s1", campo: "", via: "servico", como: "Busca", evidencia: "" },
    { tipo: "navegacao", para: "nova-s0", campo: "anterior", via: "", como: "Sem tipo: o primeiro formato", evidencia: "" },
  ]);
  assert.deepEqual(adaptFeatureScreen(tela("s9", "Sem", "/z"), feature("nova")).navega, []);
});

test("links: both directions, across the canvas merge (nova-s2 lives under the canvas id s2)", () => {
  const canvas = [{ id: "s1", title: "Etapa 1", route: "/a" }, { id: "s2", title: "Etapa 2", route: "/b" }];
  const features = [
    adaptFeatureScreen(tela("s1", "Etapa 1", "/a", [{ tipo: "navegacao", campo: "proximo", para: "nova-s2", como: "Próximo" }]), feature("nova")),
    adaptFeatureScreen(tela("s2", "Etapa 2", "/b", [
      { tipo: "navegacao", campo: "anterior", para: "nova-s1", como: "Anterior" },
      { tipo: "chamada", para: "apoio-s1", como: "Prévia", via: "servico", evidencia: "Calc.java:9" },
      { tipo: "navegacao", para: "sumiu-s1", como: "Não existe" },
    ]), feature("nova")),
    adaptFeatureScreen(tela("s1", "Consultas de apoio", "/api"), feature("apoio")),
  ];
  const screens = linkScreens(mergeScreens(canvas, features));
  const s1 = screens.find((s) => s.id === "s1");
  const s2 = screens.find((s) => s.id === "s2");
  const apoio = screens.find((s) => s.id === "apoio-s1");
  assert.deepEqual(s1.links.vaiPara.map((l) => [l.id, l.campo]), [["s2", "proximo"]]);
  assert.deepEqual(s2.links.vemDe.map((l) => [l.id, l.campo, l.title]), [["s1", "proximo", "Etapa 1"]]);
  assert.deepEqual(s2.links.vaiPara.filter((l) => !l.broken).map((l) => l.id), ["s1"]);
  assert.deepEqual(s1.links.vemDe.map((l) => l.id), ["s2"]);
  assert.deepEqual(s2.links.chama.map((l) => [l.id, l.via, l.evidencia]), [["apoio-s1", "servico", "Calc.java:9"]]);
  assert.deepEqual(apoio.links.chamadaPor.map((l) => l.id), ["s2"]);
  assert.deepEqual(s2.links.vaiPara.filter((l) => l.broken).map((l) => l.para), ["sumiu-s1"]);
});

test("links: a screen that points to itself shows on both sides; repeated runs do not pile up", () => {
  const screens = [{ id: "c-s1", title: "Casca", navega: [{ tipo: "navegacao", para: "c-s1", campo: "voltar", como: "Menu" }] }];
  linkScreens(screens);
  linkScreens(screens);
  assert.equal(screens[0].links.vaiPara.length, 1);
  assert.equal(screens[0].links.vemDe.length, 1);
});

test("strip: groups with data attributes, the source field on Vem de, broken targets not clickable", () => {
  const html = renderScreenLinks({
    id: "s2",
    links: {
      vemDe: [{ id: "s1", title: "Etapa 1", campo: "proximo", como: "Próximo", evidencia: "a.html:1", via: "" }],
      vaiPara: [{ id: null, para: "sumiu-s1", title: "sumiu-s1", campo: "", como: "", evidencia: "", via: "", broken: true }],
      chama: [{ id: "apoio-s1", title: "Consultas", campo: "", como: "Prévia", evidencia: "", via: "servico" }],
      chamadaPor: [],
    },
  });
  assert.match(html, /Telas ligadas/);
  assert.match(html, /data-screen-link="s1" data-screen-field="proximo"/);
  assert.match(html, /data-screen-link="apoio-s1" data-screen-field=""/);
  assert.match(html, /serviço/);
  assert.match(html, /doc-chip-missing[^>]*>.*sumiu-s1/);
  assert.ok(!html.includes("É chamada por"), "empty groups are hidden");
  assert.ok(!/onclick=/.test(html));
  assert.equal(renderScreenLinks({ id: "x", links: { vemDe: [], vaiPara: [], chama: [], chamadaPor: [] } }), "");
});

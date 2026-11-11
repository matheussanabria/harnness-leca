import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { featuresBodyHtml } from "../ui/public/js/modules/design-scrum-story-features.js";

const require = createRequire(import.meta.url);
const { readStoryFeatures } = require("../ui/server/services/story-features.service.js");
const { readFeatureScreens, mergeScreens } = require("../ui/server/services/project-screens-features.js");
const { adaptFeatureScreen } = require("../ui/server/services/feature-screen-adapter.js");

/** Repo ficticio: cada item de `features` vira doc/sistema/features/<slug>/ com _status.md e, se houver, mapa. */
function repoWith(features) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "story-features-"));
  for (const [slug, { historias, telas }] of Object.entries(features)) {
    const dir = path.join(root, "doc", "sistema", "features", slug);
    fs.mkdirSync(dir, { recursive: true });
    const list = historias.map((h) => `  - ${h}`).join("\n");
    fs.writeFileSync(path.join(dir, "_status.md"), `---\naliases: ["Status: ${slug} titulo"]\nhistorias:\n${list}\nprefixo: X\n---\n`);
    if (telas) fs.writeFileSync(path.join(dir, "mapa-camadas.json"), JSON.stringify({ telas }));
  }
  return root;
}

const tela = (id, rota, extra = {}) => ({ id, titulo: `Tela ${id}`, rota, campos: [], ...extra });

test("CP-01: historia lista as funcionalidades de que e dona", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal"] } });
  const { stories } = readStoryFeatures(root, []);
  assert.deepEqual(stories["DIS-443"].dona.map((f) => f.slug), ["alfa"]);
  assert.equal(stories["DIS-443"].relacionada.length, 0);
});

test("CP-02: historia secundaria ou guarda-chuva aparece como relacionada com o papel", () => {
  const root = repoWith({ alfa: { historias: ["DIS-461 principal", "DIS-443 guarda-chuva"] } });
  const { stories } = readStoryFeatures(root, []);
  assert.equal(stories["DIS-443"].dona.length, 0);
  assert.equal(stories["DIS-443"].relacionada[0].papel, "guarda-chuva");
});

test("CP-03: funcionalidade informa as outras historias que a tocam", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal", "DIS-454 secundaria"] } });
  const { stories } = readStoryFeatures(root, []);
  assert.deepEqual(stories["DIS-443"].dona[0].outras, [{ key: "DIS-454", papel: "secundaria" }]);
});

test("CP-04: funcionalidade com tela no mapa traz o id da tela", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal"], telas: [tela("s1", "pacientes/:cns/alfa")] } });
  const screens = mergeScreens([], readFeatureScreens(root));
  const { stories } = readStoryFeatures(root, screens);
  assert.deepEqual(stories["DIS-443"].dona[0].screens.map((s) => s.screenId), ["alfa-s1"]);
});

test("CP-05: funcionalidade sem mapa nao traz telas", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal"] } });
  const { stories } = readStoryFeatures(root, []);
  assert.deepEqual(stories["DIS-443"].dona[0].screens, []);
});

test("CP-06: as telas das funcionalidades vem depois das do canvas", () => {
  const root = repoWith({ alfa: { historias: ["DIS-1 principal"], telas: [tela("s1", "rota/a")] } });
  const merged = mergeScreens([{ id: "s1", route: "canvas/x", title: "Canvas" }], readFeatureScreens(root));
  assert.deepEqual(merged.map((s) => s.id), ["s1", "alfa-s1"]);
  assert.equal(merged[1].feature, "alfa");
});

test("CP-07: tela com a mesma rota do canvas nao duplica e o link aponta para a do canvas", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal"], telas: [tela("s9", "Pacientes/:cns/Visao-Geral")] } });
  const merged = mergeScreens([{ id: "s4", route: "pacientes/:cns/visao-geral", title: "Visao geral" }], readFeatureScreens(root));
  assert.equal(merged.length, 1);
  const { stories } = readStoryFeatures(root, merged);
  assert.deepEqual(stories["DIS-443"].dona[0].screens.map((s) => s.screenId), ["s4"]);
});

test("CP-08: historia sem funcionalidades responde vazio, sem erro na secao", () => {
  const root = repoWith({ alfa: { historias: ["DIS-443 principal"] } });
  const { stories } = readStoryFeatures(root, []);
  assert.equal(stories["DIS-999"], undefined);
  assert.match(featuresBodyHtml(stories["DIS-999"]), /Nenhuma funcionalidade/);
});

test("repositorio sem doc/sistema/features nao e encontrado", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "story-features-empty-"));
  assert.equal(readStoryFeatures(root, []).found, false);
  assert.deepEqual(readFeatureScreens(root), []);
});

test("adaptador traduz situacoes e chaves para o formato do mapa", () => {
  const screen = adaptFeatureScreen(
    {
      id: "s1", titulo: "T", rota: "r",
      campos: [{ id: "c", rotulo: "Campo", ui: { t: "x", st: "implementado" }, regra: { t: "r", st: "diverge" } }],
      endpoints: [{ campos: ["c"], metodo: "GET", rota: "/x", st: "a-confirmar" }],
      testes: { grupos: [{ endpoint: "GET /x", st: "automatizado", cenarios: [{ titulo: "caso", tipo: "borda" }] }] },
    },
    { slug: "alfa", featureTitle: "Alfa" },
  );
  assert.equal(screen.fields[0].ui.st, "ok");
  assert.equal(screen.fields[0].rule.st, "div");
  assert.equal(screen.endpoints[0].m, "GET");
  assert.equal(screen.endpoints[0].st, "conf");
  assert.equal(screen.tests.groups[0].st, "auto");
  assert.deepEqual(screen.tests.groups[0].cases, [["caso", "borda"]]);
});

test("CP-04/CP-05: o HTML mostra Ver no mapa com tela e sem mapa ainda sem tela", () => {
  const html = featuresBodyHtml({
    dona: [
      { slug: "a", title: "A", papel: "principal", outras: [], screens: [{ screenId: "a-s1", title: "Tela" }] },
      { slug: "b", title: "B", papel: "principal", outras: [], screens: [] },
    ],
    relacionada: [],
  });
  assert.match(html, /data-screen-id="a-s1"/);
  assert.match(html, /Ver no mapa/);
  assert.match(html, /sem mapa ainda/);
});

test("real: telas e historia de dispensacao, quando o repositorio existe", { skip: !fs.existsSync("C:/Users/matheuss.rodrigues/git/saude/dispensacao/doc/sistema/features") }, () => {
  const root = "C:/Users/matheuss.rodrigues/git/saude/dispensacao";
  const screens = readFeatureScreens(root);
  assert.ok(screens.length >= 10);
  assert.ok(screens.every((s) => s.id && s.title && Array.isArray(s.fields)));
});

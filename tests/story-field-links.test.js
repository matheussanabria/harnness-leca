import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { featuresBodyHtml } from "../ui/public/js/modules/design-scrum-story-features.js";
import { renderScreenReplica } from "../ui/public/js/modules/design-layers/layers-screen-replica.js";
import { prototypeFrameUrl } from "../ui/public/js/modules/design-layers/layers-screen-replica-proto.js";

const require = createRequire(import.meta.url);
const { readStoryFeatures } = require("../ui/server/services/story-features.service.js");
const { attachPrototypes } = require("../ui/server/services/project-screens-prototypes.js");

const SCREENS = [
  { id: "s2", title: "2 · Medicamentos e calculo", short: "2 · Medicamentos e calculo", fields: [{ id: "periodo", label: "Periodo da posologia" }, { id: "lista", label: "Lista" }] },
  { id: "entregas-liberadas-s1", title: "Entregas liberadas", fields: [] },
];

const ROWS = [
  { k: "s2-periodo", grupo: "2 · Medicamentos e calculo", rotulo: "Periodo da posologia", tela: "s2", campo: "periodo", principal: "DIS-443", relacionadas: ["DIS-461"], conferido: false },
  { k: "hist", grupo: "Historico", rotulo: "Tela Historico", tela: null, campo: null, principal: "DIS-461", relacionadas: [], conferido: true },
];

function repoWith({ rows, proto } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "story-field-links-"));
  const dir = path.join(root, "doc", "sistema", "features");
  fs.mkdirSync(dir, { recursive: true });
  if (rows) fs.writeFileSync(path.join(dir, "_historias-funcionalidades.json"), JSON.stringify({ funcionalidades: rows }));
  if (proto) fs.writeFileSync(path.join(dir, "_prototipos.json"), JSON.stringify(proto));
  return root;
}

test("CP-01: historia dona de um vinculo com tela e campo", () => {
  const { stories } = readStoryFeatures(repoWith({ rows: ROWS }), SCREENS);
  const item = stories["DIS-443"].campos.dona[0];
  assert.equal(item.screenId, "s2");
  assert.equal(item.fieldId, "periodo");
});

test("CP-02: historia relacionada aparece como relacionada", () => {
  const { stories } = readStoryFeatures(repoWith({ rows: ROWS }), SCREENS);
  assert.deepEqual(stories["DIS-461"].campos.relacionada.map((i) => i.k), ["s2-periodo"]);
  assert.deepEqual(stories["DIS-461"].campos.dona.map((i) => i.k), ["hist"]);
});

test("CP-03: vinculo sem tela vem sem screenId", () => {
  const { stories } = readStoryFeatures(repoWith({ rows: ROWS }), SCREENS);
  assert.equal(stories["DIS-461"].campos.dona[0].screenId, null);
});

test("CP-04: rotulos da tela e do campo vem do mapa", () => {
  const { stories } = readStoryFeatures(repoWith({ rows: ROWS }), SCREENS);
  const item = stories["DIS-443"].campos.dona[0];
  assert.equal(item.screenTitle, "2 · Medicamentos e calculo");
  assert.equal(item.fieldLabel, "Periodo da posologia");
});

test("CP-05: sem o arquivo de vinculos o painel usa so as funcionalidades", () => {
  const result = readStoryFeatures(repoWith(), SCREENS);
  assert.deepEqual(result.stories, {});
  const html = featuresBodyHtml({ dona: [{ slug: "a", title: "A", papel: "principal", outras: [], screens: [] }], relacionada: [], campos: { dona: [], relacionada: [] } });
  assert.match(html, /sem mapa ainda/);
  assert.ok(!html.includes("<details"));
});

test("CP-06: painel mostra Ver no mapa com tela e campo, e sem mapa ainda sem tela", () => {
  const { stories } = readStoryFeatures(repoWith({ rows: ROWS }), SCREENS);
  const html = featuresBodyHtml(stories["DIS-461"]);
  assert.match(html, /data-screen-id="s2" data-field-id="periodo"/);
  assert.match(html, /sem mapa ainda/);
  assert.match(html, /a validar/);
});

test("CP-07: tela com protótipo ligado recebe o protótipo", () => {
  const root = repoWith({ proto: { prototipo: "dis-paciente", telas: { "entregas-liberadas-s1": "entregas-liberadas", s2: 5 } } });
  const out = attachPrototypes(SCREENS, root);
  assert.deepEqual(out[1].prototype, { id: "dis-paciente", screen: "entregas-liberadas", selectors: {} });
  assert.equal(out[0].prototype, undefined);
});

test("CP-07: sem arquivo ou com protótipo invalido as telas ficam como estao", () => {
  assert.deepEqual(attachPrototypes(SCREENS, repoWith()), SCREENS);
  const bad = repoWith({ proto: { prototipo: "../x", telas: { s2: "a" } } });
  assert.deepEqual(attachPrototypes(SCREENS, bad), SCREENS);
});

test("CP-08: tela com protótipo mostra o iframe e sem protótipo mostra a replica", () => {
  const withProto = renderScreenReplica({ id: "x-s1", title: "Historico de prescricoes", route: "r", fields: [], prototype: { id: "dis-paciente", screen: "historico" } });
  assert.match(withProto, /<iframe/);
  assert.match(withProto, /design\/prototypes\/dis-paciente\/render\/historico/);
  const without = renderScreenReplica({ id: "x-s2", title: "Outra tela", route: "r", fields: [] });
  assert.ok(!without.includes("<iframe"));
});

test("a URL do protótipo e escapada", () => {
  assert.equal(prototypeFrameUrl("a b", { id: "p", screen: "t" }), "/api/project/a%20b/design/prototypes/p/render/t");
});

test("real: vinculos e protótipos de dispensacao, quando o repositorio existe", { skip: !fs.existsSync("C:/Users/matheuss.rodrigues/git/saude/dispensacao/doc/sistema/features/_historias-funcionalidades.json") }, () => {
  const root = "C:/Users/matheuss.rodrigues/git/saude/dispensacao";
  const { stories } = readStoryFeatures(root, []);
  // Smoke test sobre dados reais: não fixa quantos campos cada história tem, porque a classificação muda
  // (em 16/11/2026 a DIS-443 caiu de 21 para 7 campos). Confere só que os vínculos são lidos.
  const total = Object.values(stories).reduce((n, s) => n + s.campos.dona.length, 0);
  assert.ok(total >= 10, `esperava ao menos 10 campos com história dona, veio ${total}`);
  assert.ok(stories["DIS-443"].campos.dona.length >= 1);
});

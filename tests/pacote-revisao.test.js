import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
const { normalize } = require("../tools/pacote-revisao/config.js");
const { applyCorrections } = require("../tools/pacote-revisao/map-data.js");
const { runCheck, selectorMatches } = require("../tools/pacote-revisao/check.js");
const { fingerprint, writeManifest } = require("../tools/pacote-revisao/manifest.js");
const { renderBoardHtml } = require("../tools/pacote-revisao/board-html.js");

const base = () => ({
  titulo: "Quadro X",
  historias: ["DIS-1", "DIS-2"],
  colunas: [{ id: "a", nome: "A fazer" }, { id: "b", nome: "Feito" }],
  statusParaColuna: { "a fazer": "a", feito: "b" },
  epicos: { "DIS-9": { nome: "Epico", fundo: "#fff", texto: "#000" } },
  statusForcado: [{ key: "DIS-1", status: "Feito", desde: "2026-11-12", motivo: "informado" }],
  correcoes: [],
  esconderNoPrototipo: [],
});

const screens = () => [{
  id: "s1", title: "Tela 1",
  fields: [{ id: "f1", ui: { t: "Texto." } }],
  diffs: [{ item: "A" }, { item: "B" }, { item: "C" }],
  prototype: { id: "p", screen: "tela-1", selectors: {} },
}];

const emptyMap = (extra = {}) => ({ fixes: { absorvidas: [], semAlvo: [] }, screensData: { screens: screens() }, protos: { "tela-1": '<div id="a" class="x y"></div>' }, ...extra });
const board = (statusDoSnapshot) => ({ stories: [{ key: "DIS-1", statusDoSnapshot }] });

/** Contexto minimo para runCheck, com pastas reais para o manifesto. */
function ctxWith(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pacote-revisao-"));
  const repo = path.join(dir, "repo");
  const projectDir = path.join(dir, "projeto");
  const outDir = path.join(dir, "saida");
  fs.mkdirSync(path.join(repo, "doc", "sistema", "features", "x"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "doc", "scrum", "DIS-1"), { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(repo, "doc", "sistema", "features", "x", "mapa-camadas.json"), "{}");
  fs.writeFileSync(path.join(outDir, "doc", "scrum", "DIS-1", "user-story.md"), "# DIS-1");
  const configFile = path.join(dir, "pacote-revisao.json");
  fs.writeFileSync(configFile, JSON.stringify(config));
  return { dir, slug: "x", repo, projectDir, configFile, outDir, config };
}

const codes = (findings) => findings.map((f) => f.code);

test("CP-01: configuracao valida e carregada", () => {
  const c = normalize(base());
  assert.deepEqual(c.historias, ["DIS-1", "DIS-2"]);
  assert.equal(c.colunas.length, 2);
  assert.equal(c.statusForcado[0].status, "Feito");
});

test("CP-02: ajuste manual sem data e motivo e recusado", () => {
  const raw = base();
  raw.statusForcado = [{ key: "DIS-1", status: "Feito", desde: "2026-11-12" }];
  assert.throws(() => normalize(raw), /statusForcado\[0\].*desde.*motivo/);
  const raw2 = base();
  raw2.historias = ["abc"];
  assert.throws(() => normalize(raw2), /chave de historia invalida/);
});

test("CP-03: correcao do mapa entra depois do item indicado", () => {
  const s = screens();
  const r = applyCorrections(s, [{ tela: "s1", campo: "f1", depoisDe: "A", acrescentarAoCampo: "Extra.", diferenca: { item: "NOVA", proto: "p", code: "c", st: "proto" }, desde: "d", motivo: "m" }]);
  assert.deepEqual(s[0].diffs.map((d) => d.item), ["A", "NOVA", "B", "C"]);
  assert.equal(s[0].fields[0].ui.t, "Texto. Extra.");
  assert.equal(r.absorvidas.length, 0);
});

test("CP-04: correcao que a fonte ja tem e absorvida e nao duplica", () => {
  const s = screens();
  s[0].fields[0].ui.t = "Texto. Extra.";
  const r = applyCorrections(s, [{ tela: "s1", campo: "f1", acrescentarAoCampo: "Extra.", diferenca: { item: "B" }, desde: "d", motivo: "m" }]);
  assert.equal(s[0].diffs.length, 3);
  assert.equal(s[0].fields[0].ui.t, "Texto. Extra.");
  assert.deepEqual(r.absorvidas.map((a) => a.parte).sort(), ["campo", "diferenca"]);
});

test("CP-05: correcao sem tela ou campo alvo e erro", () => {
  const cfg = { ...base(), statusForcado: [] };
  const ctx = ctxWith(cfg);
  const r = applyCorrections(screens(), [{ tela: "s1", campo: "nao-existe", diferenca: { item: "Z" }, desde: "d", motivo: "m" }]);
  assert.equal(r.semAlvo.length, 1);
  const found = runCheck({ ctx, map: emptyMap({ fixes: r }), board: board("A fazer") });
  assert.ok(found.some((f) => f.code === "CORRECAO_SEM_ALVO" && f.level === "erro"));
});

test("CP-06: status informado que o snapshot ja alcancou e aviso", () => {
  const ctx = ctxWith(base());
  const absorvido = runCheck({ ctx, map: emptyMap(), board: board("Feito") });
  assert.ok(absorvido.some((f) => f.code === "STATUS_ABSORVIDO" && /remova o statusForcado/.test(f.message)));
  const ajustado = runCheck({ ctx, map: emptyMap(), board: board("A fazer") });
  assert.ok(ajustado.some((f) => f.code === "STATUS_AJUSTADO" && f.level === "info"));
  assert.ok(!codes(ajustado).includes("STATUS_ABSORVIDO"));
});

test("CP-07: trecho escondido e seletor de pino que sumiram do prototipo sao avisos", () => {
  const cfg = { ...base(), statusForcado: [], esconderNoPrototipo: [{ tela: "tela-1", seletores: ["#sumiu", "#a"], desde: "d", motivo: "m" }] };
  const ctx = ctxWith(cfg);
  const map = emptyMap();
  map.screensData.screens[0].prototype.selectors = { f1: "#nao-tem", f2: ".x.y" };
  const found = runCheck({ ctx, map, board: board("A fazer") });
  const orfaos = found.filter((f) => f.code === "ESCONDER_ORFAO");
  assert.equal(orfaos.length, 1);
  assert.match(orfaos[0].message, /#sumiu/);
  const pinos = found.filter((f) => f.code === "SELETOR_ORFAO");
  assert.equal(pinos.length, 1);
  assert.match(pinos[0].message, /s1\/f1/);
});

test("CP-08: seletor com atributo, pseudo-classe e alternativas e resolvido", () => {
  const html = '<label class="ds-check"><input type="checkbox"></label><div id="anexar" class="ds-field x" data-component="dis.search-field"></div>';
  assert.equal(selectorMatches("#anexar", html), true);
  assert.equal(selectorMatches("#nao", html), false);
  assert.equal(selectorMatches('.ds-field:has(#estab)', html), false);
  assert.equal(selectorMatches('label.ds-check:has(input[type="checkbox"])', html), true);
  assert.equal(selectorMatches('[data-component="dis.search-field"]', html), true);
  assert.equal(selectorMatches('[data-component="dis.outro"]', html), false);
  assert.equal(selectorMatches('table thead th:nth-child(6), [data-component="dis.search-field"]', html), true);
  assert.equal(selectorMatches(".ds", html), false);
});

test("CP-09: pacote defasado e apontado por grupo de fonte", () => {
  const cfg = { ...base(), statusForcado: [] };
  const ctx = ctxWith(cfg);
  const fontes = fingerprint({ ...ctx, historias: cfg.historias });
  writeManifest(ctx.outDir, { geradoEm: "2026-11-01T00:00:00Z", fontes });
  const limpo = runCheck({ ctx, map: emptyMap(), board: board("A fazer") });
  assert.ok(!codes(limpo).includes("PACOTE_DEFASADO"));
  fs.writeFileSync(path.join(ctx.repo, "doc", "sistema", "features", "x", "mapa-camadas.json"), '{"mudou":true}');
  fs.writeFileSync(path.join(ctx.outDir, "doc", "scrum", "DIS-1", "pr-descricao.md"), "novo");
  const defasado = runCheck({ ctx, map: emptyMap(), board: board("A fazer") }).filter((f) => f.code === "PACOTE_DEFASADO");
  const texto = defasado.map((f) => f.message).join("\n");
  assert.match(texto, /mapa-camadas\.json/);
  assert.match(texto, /arquivos das historias no pacote/);
  assert.match(texto, /2026-11-01/);
});

test("CP-10: quadro escapa o fechamento de script e traz as colunas da configuracao", () => {
  const cfg = normalize(base());
  const stories = [{ key: "DIS-1", title: "Titulo </script><b>x</b>", status: "Feito", files: [], relationships: [], features: { dona: [], relacionada: [] }, fields: { dona: [], relacionada: [] } }];
  const html = renderBoardHtml({ board: { geradoEm: "2026-11-12T00:00:00Z", stories }, config: cfg });
  const data = html.match(/id="dados" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(data, "bloco de dados presente e fechado uma unica vez");
  const parsed = JSON.parse(data[1]);
  assert.equal(parsed.stories[0].title, "Titulo </script><b>x</b>");
  assert.deepEqual(parsed.config.colunas.map((c) => c.nome), ["A fazer", "Feito"]);
  assert.match(html, /<title>Quadro X<\/title>/);
});

test("CP-11: uso incorreto da ferramenta devolve mensagem", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "pacote-revisao.js"), "build"], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--project e obrigatorio/);
  const u = spawnSync(process.execPath, [path.join(ROOT, "tools", "pacote-revisao.js")], { encoding: "utf8" });
  assert.equal(u.status, 64);
  assert.match(u.stderr, /uso: node tools\/pacote-revisao\.js/);
});

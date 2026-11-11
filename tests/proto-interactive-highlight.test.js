import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { dls } from "../ui/public/js/modules/design-layers-store.js";
import { renderPrototypeFrame, highlightMessage } from "../ui/public/js/modules/design-layers/layers-screen-replica-proto.js";
import { refreshFocusInPlace } from "../ui/public/js/modules/design-layers-focus.js";

const require = createRequire(import.meta.url);
const { attachPrototypes } = require("../ui/server/services/project-screens-prototypes.js");

const SCREENS = [{ id: "hist-s1", title: "Historico" }, { id: "outra-s1", title: "Outra" }];

function repoWith(proto) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "proto-highlight-"));
  const dir = path.join(root, "doc", "sistema", "features");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "_prototipos.json"), JSON.stringify(proto));
  return root;
}

test("CP-01: seletores da tela vem do arquivo de protótipos", () => {
  const root = repoWith({ prototipo: "dis-paciente", telas: { "hist-s1": "historico" }, seletores: { "hist-s1": { busca: "#busca", limpar: "#limpar" } } });
  const out = attachPrototypes(SCREENS, root);
  assert.deepEqual(out[0].prototype.selectors, { busca: "#busca", limpar: "#limpar" });
  assert.equal(out[1].prototype, undefined);
});

test("CP-02: seletor invalido e ignorado", () => {
  const root = repoWith({ prototipo: "dis-paciente", telas: { "hist-s1": "historico" }, seletores: { "hist-s1": { ok: " .a ", numero: 5, vazio: "  ", longo: "x".repeat(201), nulo: null } } });
  assert.deepEqual(attachPrototypes(SCREENS, root)[0].prototype.selectors, { ok: ".a" });
  const semBloco = repoWith({ prototipo: "dis-paciente", telas: { "hist-s1": "historico" } });
  assert.deepEqual(attachPrototypes(SCREENS, semBloco)[0].prototype.selectors, {});
});

test("CP-03: quadro carrega os seletores em data-selectors", () => {
  const html = renderPrototypeFrame({ title: "H", prototype: { id: "dis-paciente", screen: "historico", selectors: { busca: '[data-component="dis.search-field"]' } } });
  const match = html.match(/data-selectors="([^"]*)"/);
  assert.ok(match);
  assert.match(match[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"), /dis\.search-field/);
});

test("CP-04: campo com seletor gera a ordem de destaque", () => {
  assert.deepEqual(highlightMessage({ busca: "#busca" }, "busca"), { type: "HARNESS_PROTO_HIGHLIGHT_SELECTOR", selector: "#busca" });
});

test("CP-05: campo sem seletor ou sem campo limpa o destaque", () => {
  assert.deepEqual(highlightMessage({ busca: "#busca" }, "estados"), { type: "HARNESS_PROTO_CLEAR_HIGHLIGHT" });
  assert.deepEqual(highlightMessage({ busca: "#busca" }, null), { type: "HARNESS_PROTO_CLEAR_HIGHLIGHT" });
  assert.deepEqual(highlightMessage(undefined, "busca"), { type: "HARNESS_PROTO_CLEAR_HIGHLIGHT" });
});

test("CP-06: ponte entende o destaque por seletor e o modo play", () => {
  const bridge = fs.readFileSync(new URL("../ui/public/js/modules/prototype-bridge.js", import.meta.url), "utf8");
  const highlight = fs.readFileSync(new URL("../ui/public/js/modules/prototype-bridge-highlight.js", import.meta.url), "utf8");
  assert.match(highlight, /HARNESS_PROTO_HIGHLIGHT_SELECTOR/);
  assert.match(bridge, /HARNESS_PROTO_MODE/);
  assert.match(bridge, /mode === "play"/);
  const { loadBridgeScript } = require("../ui/server/services/prototype-sandbox-common.service.js");
  assert.match(loadBridgeScript({ fs, path }), /HARNESS_PROTO_HIGHLIGHT_SELECTOR/);
});

test("CP-07: sem quadro de protótipo o redesenho completo continua valendo", () => {
  const empty = { querySelector: () => null };
  assert.equal(refreshFocusInPlace(empty, { id: "x", fields: [] }), false);
  assert.equal(refreshFocusInPlace(null, { id: "x" }), false);
});

test("CP-07: com quadro aberto so as camadas sao refeitas", () => {
  const nodes = {
    ".replica-proto-wrap": { querySelectorAll: () => [] },
    ".layers-tabs-nav": { outerHTML: "antigo" },
    ".layers-col-right": { innerHTML: "antigo" },
  };
  const container = { querySelector: (s) => nodes[s] || null, querySelectorAll: () => [] };
  dls.focusedFieldId = null;
  const screen = { id: "s", title: "T", fields: [], rules: [], endpoints: [], entities: [], tests: { groups: [] }, legacy: [], map: [], seqs: [], chains: [] };
  assert.equal(refreshFocusInPlace(container, screen), true);
  assert.notEqual(nodes[".layers-tabs-nav"].outerHTML, "antigo");
  assert.notEqual(nodes[".layers-col-right"].innerHTML, "antigo");
});

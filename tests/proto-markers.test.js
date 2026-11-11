import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { renderPrototypeFrame } from "../ui/public/js/modules/design-layers/layers-screen-replica-proto.js";
import { buildMarkers, markersMessage, activeMarkerMessage, handleFieldClick } from "../ui/public/js/modules/design-layers/layers-screen-replica-markers.js";

const require = createRequire(import.meta.url);
const { BRIDGE_FILES, loadBridgeScript } = require("../ui/server/services/prototype-sandbox-common.service.js");

const SC = {
  title: "Medicamentos",
  fields: [{ id: "medicamento", n: 1 }, { id: "intervalo", n: 14 }, { id: "incluir", n: 11 }],
  prototype: { id: "dis-paciente", screen: "nova-prescricao-medicamentos", selectors: { medicamento: ".ds-ac", incluir: "#incluir" } },
};

test("CP-01: quadro monta os marcadores so dos campos com seletor", () => {
  assert.deepEqual(buildMarkers(SC), [
    { id: "medicamento", n: 1, selector: ".ds-ac" },
    { id: "incluir", n: 11, selector: "#incluir" },
  ]);
  const html = renderPrototypeFrame(SC);
  const attr = html.match(/data-markers="([^"]*)"/)[1].replace(/&quot;/g, '"');
  assert.equal(JSON.parse(attr).length, 2);
});

test("CP-01: sem seletores ou sem campos nao ha marcadores", () => {
  assert.deepEqual(buildMarkers({ fields: [{ id: "a", n: 1 }], prototype: { id: "p", screen: "s" } }), []);
  assert.deepEqual(buildMarkers(null), []);
});

test("CP-02: a mensagem de marcadores leva o campo ativo", () => {
  const markers = buildMarkers(SC);
  assert.deepEqual(markersMessage(markers, "incluir"), { type: "HARNESS_PROTO_MARKERS", markers, active: "incluir" });
  assert.equal(markersMessage(markers, null).active, null);
  assert.deepEqual(activeMarkerMessage("medicamento"), { type: "HARNESS_PROTO_MARKER_ACTIVE", fieldId: "medicamento" });
});

test("CP-03: clique no pino foca o campo", () => {
  const frame = { contentWindow: { id: "quadro" } };
  const focused = [];
  const ok = handleFieldClick({ data: { type: "HARNESS_PROTO_FIELD_CLICK", fieldId: "incluir" }, source: frame.contentWindow }, [frame], (id) => focused.push(id));
  assert.equal(ok, true);
  assert.deepEqual(focused, ["incluir"]);
});

test("CP-04: mensagem de outra origem ou invalida e ignorada", () => {
  const frame = { contentWindow: { id: "quadro" } };
  const focused = [];
  const focus = (id) => focused.push(id);
  assert.equal(handleFieldClick({ data: { type: "HARNESS_PROTO_FIELD_CLICK", fieldId: "x" }, source: { id: "outra" } }, [frame], focus), false);
  assert.equal(handleFieldClick({ data: { type: "OUTRO", fieldId: "x" }, source: frame.contentWindow }, [frame], focus), false);
  assert.equal(handleFieldClick({ data: { type: "HARNESS_PROTO_FIELD_CLICK", fieldId: "" }, source: frame.contentWindow }, [frame], focus), false);
  assert.equal(handleFieldClick({ data: null, source: null }, [frame], focus), false);
  assert.deepEqual(focused, []);
});

test("CP-05: o script dos marcadores esta na ponte e o pino e clicavel", () => {
  assert.ok(BRIDGE_FILES.includes("prototype-bridge-markers.js"));
  const bridge = loadBridgeScript({ fs, path });
  assert.match(bridge, /HARNESS_PROTO_MARKERS/);
  assert.match(bridge, /HARNESS_PROTO_FIELD_CLICK/);
  assert.match(bridge, /harness-pin/);
});

const PROTO_FILE = "C:/Users/matheuss.rodrigues/git/saude/dispensacao/doc/sistema/features/_prototipos.json";

test("CP-06: as quatro telas do canvas estao ligadas ao protótipo com seletores", { skip: !fs.existsSync(PROTO_FILE) }, () => {
  const map = JSON.parse(fs.readFileSync(PROTO_FILE, "utf8"));
  for (const id of ["s1", "s2", "s3", "s4"]) {
    assert.equal(typeof map.telas[id], "string", id);
    const selectors = Object.values(map.seletores[id] || {});
    assert.ok(selectors.length >= 4, id);
    assert.ok(selectors.every((s) => typeof s === "string" && s.length <= 200), id);
  }
});

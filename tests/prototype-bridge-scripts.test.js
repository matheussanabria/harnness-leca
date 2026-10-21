// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MODULES = path.resolve(__dirname, "..", "ui", "public", "js", "modules");

test("loadBridgeScript junta medidas, ponte e arrastar nessa ordem", () => {
  const { loadBridgeScript } = require("../ui/server/services/prototype-sandbox-renderer.service");
  const script = loadBridgeScript({ fs, path });
  const props = script.indexOf("__hpProps = ");
  const main = script.indexOf("HARNESS_PROTO_READY");
  const drag = script.indexOf("HARNESS_PROTO_REORDER");
  assert.ok(props >= 0 && main > props && drag > main, "ordem props < ponte < arrastar");
  assert.ok(script.includes("__harnessBridge"));
  assert.ok(script.includes("HARNESS_PROTO_STYLE") && script.includes("HARNESS_PROTO_METRICS"));
});

test("scripts do iframe e módulos do painel respeitam o teto de linhas e não têm emojis", () => {
  const files = ["prototype-bridge.js", "prototype-bridge-props.js", "prototype-bridge-drag.js", "prototype-props-model.js", "prototype-props-view.js", "prototype-props-style-view.js", "prototype-props-type-model.js", "prototype-props-code.js", "prototype-code-highlight.js", "prototype-props-code-model.js", "prototype-props-type-view.js", "prototype-props-panel.js", "prototype-edit-api.js", "prototype-layer-drag.js"];
  const emoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
  for (const name of files) {
    const text = fs.readFileSync(path.join(MODULES, name), "utf8");
    assert.ok(text.split("\n").length <= (name === "prototype-bridge.js" ? 250 : 300), `${name} acima do limite de linhas`);
    assert.equal(emoji.test(text), false, `${name} contém emoji`);
  }
});

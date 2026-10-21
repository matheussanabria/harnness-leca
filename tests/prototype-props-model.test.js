const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../ui/public/js/modules/prototype-props-model.js");

test("toCss e numOf convertem entre digitado e CSS", async () => {
  const { toCss, numOf } = await load();
  assert.equal(toCss("12"), "12px");
  assert.equal(toCss("1.5"), "1.5px");
  assert.equal(toCss("var(--space-md)"), "var(--space-md)");
  assert.equal(toCss("50%"), "50%");
  assert.equal(toCss(" "), "");
  assert.equal(numOf("270px"), "270");
  assert.equal(numOf("12.34px"), "12.3");
  assert.equal(numOf("auto"), "");
});

test("sizeMode e sizePatch seguem fixo, hug e fill", async () => {
  const { sizeMode, sizePatch } = await load();
  assert.equal(sizeMode("100%"), "fill");
  assert.equal(sizeMode("fit-content"), "hug");
  assert.equal(sizeMode("auto"), "hug");
  assert.equal(sizeMode("320px"), "fixed");
  assert.deepEqual(sizePatch("width", "fill", "10"), { width: "100%" });
  assert.deepEqual(sizePatch("height", "hug", "10"), { height: "auto" });
  assert.deepEqual(sizePatch("width", "hug", "10"), { width: "fit-content" });
  assert.deepEqual(sizePatch("width", "fixed", "200"), { width: "200px" });
});

test("translate e rotate: ida e volta", async () => {
  const { translatePatch, parseTranslate, rotatePatch, parseRotate } = await load();
  assert.deepEqual(translatePatch("10", "-4"), { translate: "10px -4px" });
  assert.deepEqual(translatePatch("0", ""), { translate: "" });
  assert.deepEqual(parseTranslate("10px -4px"), ["10", "-4"]);
  assert.deepEqual(parseTranslate("none"), ["0", "0"]);
  assert.deepEqual(rotatePatch("45"), { rotate: "45deg" });
  assert.deepEqual(rotatePatch("0"), { rotate: "" });
  assert.equal(parseRotate("45deg"), "45");
  assert.equal(parseRotate("none"), "0");
});

test("alignPatch usa margens ou align-self conforme o pai", async () => {
  const { alignPatch } = await load();
  assert.deepEqual(alignPatch("center", { display: "block" }), { "margin-left": "auto", "margin-right": "auto" });
  assert.deepEqual(alignPatch("right", { display: "flex", direction: "row" }), { "margin-left": "auto", "margin-right": "0" });
  assert.deepEqual(alignPatch("left", { display: "flex", direction: "column" }), { "align-self": "flex-start" });
  assert.deepEqual(alignPatch("bottom", { display: "flex", direction: "row" }), { "align-self": "flex-end" });
  assert.deepEqual(alignPatch("middle", { display: "flex", direction: "column" }), { "margin-top": "auto", "margin-bottom": "auto" });
  assert.equal(alignPatch("top", { display: "block" }), null);
});

test("ruleToLines e stepValue", async () => {
  const { ruleToLines, stepValue } = await load();
  assert.equal(ruleToLines(".px-p-1 { gap: 8px; display: grid; }"), ".px-p-1 {\n  gap: 8px;\n  display: grid;\n}");
  assert.equal(ruleToLines(""), "");
  assert.equal(stepValue("10", 1), "11");
  assert.equal(stepValue("10px", -10), "0");
  assert.equal(stepValue("", 1), "1");
  assert.equal(stepValue("auto", 1), null);
});

test("parseColor, colorFieldValue e swatchHex leem hex, rgb e token gravado", async () => {
  const { parseColor, colorFieldValue, swatchHex } = await load();
  assert.deepEqual(parseColor("#0af"), { hex: "#00aaff", alpha: 1 });
  assert.deepEqual(parseColor("rgb(255, 0, 0)"), { hex: "#ff0000", alpha: 1 });
  assert.deepEqual(parseColor("rgba(0, 0, 0, 0.5)"), { hex: "#000000", alpha: 0.5 });
  assert.deepEqual(parseColor("#ff000080"), { hex: "#ff0000", alpha: 0.5 });
  assert.equal(parseColor("rgba(0, 0, 0, 0)"), null);
  assert.equal(parseColor("transparent"), null);
  assert.equal(colorFieldValue("background-color", { "background-color": "var(--primary)" }, "rgb(1, 2, 3)"), "var(--primary)");
  assert.equal(colorFieldValue("background-color", {}, "rgb(255, 0, 0)"), "#ff0000");
  assert.equal(colorFieldValue("background-color", {}, "rgba(0, 0, 0, 0)"), "");
  assert.equal(colorFieldValue("background-color", {}, "rgba(0, 0, 0, 0.5)"), "rgba(0, 0, 0, 0.5)");
  assert.equal(swatchHex("var(--x)", "rgb(0, 128, 0)"), "#008000");
  assert.equal(swatchHex("", ""), "#000000");
});

test("opacidade, raio, contorno, desfoque e sombra geram os patches certos", async () => {
  const { parseOpacity, opacityPatch, uniformRadius, radiusPatch, strokePatch, STROKE_CLEAR, blurOf, blurPatch, shadowPatch, declsOf } = await load();
  assert.equal(parseOpacity("0.5"), "50");
  assert.deepEqual(opacityPatch("50"), { opacity: "0.5" });
  assert.deepEqual(opacityPatch("100"), { opacity: "" });
  assert.deepEqual(opacityPatch("150"), { opacity: "" });
  assert.deepEqual(opacityPatch("abc"), null);
  const c = { "border-top-left-radius": "4px", "border-top-right-radius": "4px", "border-bottom-right-radius": "4px", "border-bottom-left-radius": "4px" };
  assert.equal(uniformRadius(c), "4");
  assert.equal(uniformRadius({ ...c, "border-bottom-left-radius": "0px" }), null);
  assert.equal(radiusPatch("8")["border-radius"], "8px");
  assert.equal(radiusPatch("0")["border-radius"], "");
  assert.equal(radiusPatch("8")["border-top-left-radius"], "");
  assert.deepEqual(strokePatch("border-width", "2", { "border-top-style": "none" }), { "border-width": "2px", "border-style": "solid" });
  assert.deepEqual(strokePatch("border-width", "2", { "border-top-style": "dashed" }), { "border-width": "2px" });
  assert.deepEqual(strokePatch("border-style", "none"), { "border-style": "" });
  assert.equal(STROKE_CLEAR["border-width"], "");
  assert.equal(blurOf("blur(4px)"), "4");
  assert.deepEqual(blurPatch("6"), { filter: "blur(6px)" });
  assert.deepEqual(blurPatch("0"), { filter: "" });
  assert.deepEqual(shadowPatch("none"), { "box-shadow": "" });
  assert.deepEqual(shadowPatch("var(--shadow-md)"), { "box-shadow": "var(--shadow-md)" });
  assert.equal(shadowPatch("custom"), null);
  assert.deepEqual(declsOf(".px-p-1 {\n  gap: 8px;\n  background-color: var(--a);\n}"), { gap: "8px", "background-color": "var(--a)" });
});

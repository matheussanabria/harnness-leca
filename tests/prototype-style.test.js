// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { applyStyleOp, sanitizeStyles, upsertRule, readRule, classFor } = require("../ui/server/services/prototype-style.service");
const { reorderHtml } = require("../ui/server/services/prototype-reorder.service");
const { applyPrototypeEdit, undoPrototypeEdit, mutateHtmlByPid } = require("../ui/server/services/prototype-editor.service");

const HTML = `<div class="box" data-pid="p-1" style="display: flex; color: red">
  <p data-pid="p-2">A</p>
  <p data-pid="p-3">B</p>
  <section data-pid="p-4">
    <span data-pid="p-5">C</span>
  </section>
</div>`;

test("sanitizeStyles aceita propriedades do painel e recusa o resto", () => {
  assert.deepEqual(sanitizeStyles({ Width: "120px", gap: "var(--space-md)" }), [["width", "120px"], ["gap", "var(--space-md)"]]);
  assert.throws(() => sanitizeStyles({ background: "red" }), /não permitida/);
  assert.throws(() => sanitizeStyles({ width: "1px; color: red" }), /inválido/);
  assert.throws(() => sanitizeStyles({ width: "url(x)" }), /inválido/);
  assert.throws(() => sanitizeStyles({}), /Nenhum/);
});

test("applyStyleOp cria a classe, grava a regra e tira o estilo inline conflitante", () => {
  const out = applyStyleOp(HTML, "", "p-1", { display: "grid", gap: "8px" });
  assert.equal(out.cls, "px-p-1");
  assert.match(out.html, /class="box px-p-1"/);
  assert.match(out.html, /style="color: red"/);
  assert.ok(!/display: flex/.test(out.html));
  assert.match(out.css, /\.px-p-1 \{\n  display: grid;\n  gap: 8px;\n\}/);
  assert.equal(out.rule.startsWith(".px-p-1 {"), true);
});

test("applyStyleOp atualiza, remove propriedade e apaga a classe quando a regra esvazia", () => {
  const first = applyStyleOp(HTML, "", "p-2", { width: "100px", height: "20px" });
  const second = applyStyleOp(first.html, first.css, "p-2", { width: "200px", height: "" });
  assert.deepEqual(readRule(second.css, "px-p-2"), { width: "200px" });
  assert.equal((second.html.match(/px-p-2/g) || []).length, 1);
  const third = applyStyleOp(second.html, second.css, "p-2", { width: "" });
  assert.ok(!third.css.includes("px-p-2"));
  assert.equal(third.rule, "");
});

test("upsertRule preserva outras regras do proto.css", () => {
  const css = "body { margin: 0; }\n\n.outra { color: blue; }\n";
  const next = upsertRule(css, "px-p-9", [["gap", "4px"]]);
  assert.ok(next.startsWith("body { margin: 0; }"));
  assert.ok(next.includes(".outra { color: blue; }"));
  assert.deepEqual(readRule(next, "px-p-9"), { gap: "4px" });
  assert.equal(classFor("p-12"), "px-p-12");
});

test("reorderHtml move antes, depois e dentro; recusa mover para dentro de si", () => {
  const before = reorderHtml(HTML, "p-3", "p-2", "before");
  assert.ok(before.indexOf('data-pid="p-3"') < before.indexOf('data-pid="p-2"'));
  const after = reorderHtml(HTML, "p-2", "p-3", "after");
  assert.ok(after.indexOf('data-pid="p-3"') < after.indexOf('data-pid="p-2"'));
  const inside = reorderHtml(HTML, "p-2", "p-4", "inside");
  assert.ok(inside.indexOf('<section data-pid="p-4">') < inside.indexOf('data-pid="p-2"'));
  assert.ok(inside.indexOf('data-pid="p-2"') < inside.indexOf("</section>"));
  assert.equal((inside.match(/data-pid="p-2"/g) || []).length, 1);
  assert.throws(() => reorderHtml(HTML, "p-4", "p-5", "inside"), /dentro dele mesmo/);
  assert.throws(() => reorderHtml(HTML, "p-2", "p-2", "after"), /diferentes/);
  assert.throws(() => reorderHtml(HTML, "p-2", "p-99", "after"), /não encontrado/);
  assert.equal(mutateHtmlByPid(HTML, "p-3", { type: "moveTo", targetPid: "p-2", position: "before" }), before);
});

test("applyPrototypeEdit grava tela e proto.css e o undo restaura os dois", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "px-"));
  const proto = path.join(tmp, "design", "prototypes", "demo");
  fs.mkdirSync(path.join(proto, "screens"), { recursive: true });
  fs.mkdirSync(path.join(proto, "styles"), { recursive: true });
  fs.writeFileSync(path.join(proto, "screens", "home.html"), HTML);
  fs.writeFileSync(path.join(proto, "styles", "proto.css"), "body { margin: 0; }\n");

  const res = applyPrototypeEdit(tmp, "demo", "home", "p-2", { type: "setStyles", styles: { width: "50%" } });
  assert.equal(res.ok, true);
  assert.equal(res.cls, "px-p-2");
  assert.match(fs.readFileSync(path.join(proto, "screens", "home.html"), "utf8"), /class="px-p-2"/);
  assert.match(fs.readFileSync(path.join(proto, "styles", "proto.css"), "utf8"), /width: 50%/);

  const moved = applyPrototypeEdit(tmp, "demo", "home", "p-3", { type: "moveTo", targetPid: "p-2", position: "before" });
  assert.equal(moved.ok, true);

  assert.equal(undoPrototypeEdit(tmp, "demo", "home").ok, true);
  assert.equal(undoPrototypeEdit(tmp, "demo", "home").ok, true);
  assert.equal(fs.readFileSync(path.join(proto, "screens", "home.html"), "utf8"), HTML);
  assert.equal(fs.readFileSync(path.join(proto, "styles", "proto.css"), "utf8"), "body { margin: 0; }\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("sanitizeStyles aceita aparência, preenchimento, contorno e efeitos", () => {
  const out = sanitizeStyles({ opacity: "0.5", "border-radius": "8px", "background-color": "var(--primary-base)", "border-color": "rgba(0, 0, 0, 0.2)", "border-width": "1px", "border-style": "solid", "box-shadow": "0 4px 8px rgba(0,0,0,.2)", filter: "blur(4px)" });
  assert.equal(out.length, 8);
  assert.throws(() => sanitizeStyles({ "background-image": "linear-gradient(red, blue)" }), /não permitida/);
  assert.throws(() => sanitizeStyles({ "box-shadow": "0 0 0 red; color: blue" }), /inválido/);
});

test("applyStyleOp grava cor com token e some com a classe ao limpar tudo", () => {
  const a = applyStyleOp(HTML, "", "p-3", { "background-color": "var(--primary-base)", "border-width": "1px", "border-style": "solid" });
  assert.match(a.css, /background-color: var\(--primary-base\);/);
  const b = applyStyleOp(a.html, a.css, "p-3", { "background-color": "", "border-width": "", "border-style": "" });
  assert.ok(!b.css.includes("px-p-3"));
  assert.ok(!/px-p-3/.test(b.html));
});

test("sanitizeStyles aceita propriedades de tipografia e rejeita valores perigosos", () => {
  const { sanitizeStyles } = require("../ui/server/services/prototype-style.service");
  const out = sanitizeStyles({ "font-family": "'Open Sans', sans-serif", "font-weight": "600", "line-height": "1.5", "letter-spacing": "0.5px", "text-align": "center", color: "var(--cor)" });
  assert.equal(out.length, 6);
  assert.throws(() => sanitizeStyles({ "font-family": "x; background:url(http://a)" }), /inválido/);
});

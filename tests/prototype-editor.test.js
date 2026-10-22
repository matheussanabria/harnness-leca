// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  sanitizeText,
  sanitizeClass,
  sanitizeStyleToken,
  calculateFingerprint,
  makeUnifiedDiff,
  mutateHtmlByPid,
  previewPrototypeEdit,
  applyPrototypeEdit,
  undoPrototypeEdit,
} = require("../ui/server/services/prototype-editor.service");

test("prototype-editor: sanitizeText faz escape de HTML e recusa scripts", () => {
  assert.equal(sanitizeText("Olá <b>Mundo</b>"), "Olá &lt;b&gt;Mundo&lt;/b&gt;");
  assert.throws(() => sanitizeText("Ataque <script>alert(1)</script>"), /não pode conter scripts/);
});

test("prototype-editor: sanitizeClass aceita classes válidas e recusa caracteres maliciosos", () => {
  assert.equal(sanitizeClass("ds-card ds-card--active"), "ds-card ds-card--active");
  assert.throws(() => sanitizeClass("btn' onmouseover='evil()"), /caracteres proibidos/);
  assert.throws(() => sanitizeClass("ds-card; color:red"), /caracteres proibidos/);
});

test("prototype-editor: sanitizeStyleToken aceita variáveis do DS e recusa comandos proibidos", () => {
  const token = sanitizeStyleToken("color", "var(--ds-color-primary)");
  assert.equal(token.property, "color");
  assert.equal(token.value, "var(--ds-color-primary)");

  assert.throws(() => sanitizeStyleToken("color", "red; background: blue"), /caracteres ou comandos proibidos/);
  assert.throws(() => sanitizeStyleToken("background", "url('http://evil.com/leak')"), /caracteres ou comandos proibidos/);
  assert.throws(() => sanitizeStyleToken("color", "@import 'malware.css'"), /caracteres ou comandos proibidos/);
});

test("prototype-editor: mutateHtmlByPid executa setText, setClasses, setAttr e setToken via data-pid", () => {
  const initialHtml = `<div class="card" data-pid="p-1"><h2 data-pid="p-2">Título Velho</h2><input type="text" placeholder="Antigo" data-pid="p-3" /></div>`;

  // 1. setText
  const withNewText = mutateHtmlByPid(initialHtml, "p-2", { type: "setText", text: "Título Novo & Limpo" });
  assert.match(withNewText, /Título Novo &amp; Limpo/);
  assert.doesNotMatch(withNewText, /Título Velho/);

  // 2. setClasses
  const withNewClasses = mutateHtmlByPid(withNewText, "p-1", { type: "setClasses", classes: "ds-card ds-card--featured" });
  assert.match(withNewClasses, /class="ds-card ds-card--featured"/);

  // 3. setAttr
  const withNewAttr = mutateHtmlByPid(withNewClasses, "p-3", { type: "setAttr", name: "placeholder", value: "Digite seu nome..." });
  assert.match(withNewAttr, /placeholder="Digite seu nome\.\.\."/);

  // 4. setToken
  const withToken = mutateHtmlByPid(withNewAttr, "p-2", { type: "setToken", property: "color", value: "var(--ds-color-primary)" });
  assert.match(withToken, /style="color: var\(--ds-color-primary\)"/);
});

test("prototype-editor: preview, apply com fingerprint 409 e undo", () => {
  const memoryFs = new Map();
  const screenPath = "/proj/design/prototypes/proto-1/screens/home.html";
  const initialHtml = `<div data-pid="p-1"><p data-pid="p-2">Original</p></div>`;

  const norm = (p) => p.replace(/\\/g, "/");
  memoryFs.set(norm(screenPath), initialHtml);

  const mockDeps = {
    fs: {
      existsSync: (p) => memoryFs.has(norm(p)),
      readFileSync: (p) => memoryFs.get(norm(p)) || "",
      writeFileSync: (p, data) => memoryFs.set(norm(p), data),
      renameSync: (src, dest) => {
        memoryFs.set(norm(dest), memoryFs.get(norm(src)));
        memoryFs.delete(norm(src));
      },
    },
    path,
  };

  // 1. Preview
  const preview = previewPrototypeEdit("/proj", "proto-1", "home", "p-2", { type: "setText", text: "Modificado" }, mockDeps);
  assert.equal(preview.ok, true);
  assert.match(preview.diff, /-\s*.*Original/);
  assert.match(preview.diff, /\+\s*.*Modificado/);

  // 2. Conflito de fingerprint (HTTP 409)
  const conflictResult = applyPrototypeEdit(
    "/proj",
    "proto-1",
    "home",
    "p-2",
    { type: "setText", text: "Modificado" },
    "fingerprint_invalido_concorrente",
    mockDeps
  );
  assert.equal(conflictResult.ok, false);
  assert.equal(conflictResult.conflict, true);

  // 3. Apply com fingerprint correto
  const applyResult = applyPrototypeEdit(
    "/proj",
    "proto-1",
    "home",
    "p-2",
    { type: "setText", text: "Modificado" },
    preview.fingerprint,
    mockDeps
  );
  assert.equal(applyResult.ok, true);
  assert.match(memoryFs.get(norm(screenPath)), /Modificado/);

  // 4. Undo desfaz alteração de volta para "Original"
  const undoResult = undoPrototypeEdit("/proj", "proto-1", "home", mockDeps);
  assert.equal(undoResult.ok, true);
  assert.match(memoryFs.get(norm(screenPath)), /Original/);
});

test("setHtml troca o componente inteiro, mantém o pid raiz e dá pid novo só aos elementos novos", () => {
  const { mutateHtmlByPid } = require("../ui/server/services/prototype-editor.service");
  const html = '<div data-pid="p-1"><section data-pid="p-2"><p data-pid="p-3">a</p></section><span data-pid="p-9">z</span></div>';
  const out = mutateHtmlByPid(html, "p-2", { type: "setHtml", html: '<section><h2>t</h2><!-- <b> --><input value="x"/><p>b</p></section>' });
  assert.equal(out, '<div data-pid="p-1"><section data-pid="p-2"><h2 data-pid="p-10">t</h2><!-- <b> --><input value="x" data-pid="p-11" /><p data-pid="p-12">b</p></section><span data-pid="p-9">z</span></div>');
});

test("setHtml preserva os pids que o HTML novo já traz e recusa mais de um elemento raiz", () => {
  const { mutateHtmlByPid } = require("../ui/server/services/prototype-editor.service");
  const html = '<div data-pid="p-1"><section data-pid="p-2"><p data-pid="p-3">a</p></section></div>';
  const out = mutateHtmlByPid(html, "p-2", { type: "setHtml", html: '<section data-pid="p-2"><p data-pid="p-3">novo</p></section>' });
  assert.match(out, /<p data-pid="p-3">novo<\/p>/);
  assert.throws(() => mutateHtmlByPid(html, "p-2", { type: "setHtml", html: "<section>a</section><div>b</div>" }), /tags desbalanceadas/);
  assert.throws(() => mutateHtmlByPid(html, "p-2", { type: "setHtml", html: "texto solto" }), /começar por um elemento/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractDcDocs, classNames, requiredTokens, allRequiredTokens, findArrayEnd } = require("../tools/ds-docs/extract-dc");
const { buildTokensCss, buildIndex } = require("../tools/ds-docs/dc-tokens");
const { run } = require("../tools/import-dc-design-system");

// Same shape as a ".dc.html" Design System: a class field, brackets and quotes inside strings, one variant component.
const FIXTURE = `<html><body><x-dc><helmet><style>body{margin:0}</style></helmet><main>Documentation shell</main></x-dc><script type="text/x-dc" data-dc-script>
class Component extends DCLogic {
  VARS = { chart: ['A', 'B'] };
  DOCS = [
    { id: 'button', name: 'Button', states: 'default · hover',
      desc: 'Acao [primaria] do usuario.',
      html: '<button class="btn btn--primary" type="button">OK ]</button>',
      css: '.btn{background:var(--primary-interactive);color:#fff}\\n.btn--primary:hover{background:var(--primary-dark)}',
      ng: 'x', react: 'y' },
    { id: 'meter', name: 'Meter', states: 'value',
      html: '<div class="meter" style="--fill:40%"></div>',
      css: '.meter{width:var(--fill);background:var(--success-base);--local:1px}' },
    { id: 'chart', name: 'Chart', states: 'variants', html: { a: '<svg/>' }, css: { a: '' } },
  ];
  JS = { button: 'document.querySelector(".btn")?.focus();' };
  RX = { button: 'export function Button({ children }) { return <button>{children}</button>; }' };
  renderVals() { return this.DOCS.map((d) => { return { ...d, cat: 'Components' }; }); }
}
</script></body></html>`;

test("extractDcDocs reads the DOCS class field and selects a deterministic variant preview", () => {
  const { components, skipped } = extractDcDocs(FIXTURE);
  assert.deepEqual(components.map((c) => c.id), ["button", "meter", "chart"]);
  assert.equal(components[0].desc, "Acao [primaria] do usuario.");
  assert.ok(components[0].html.includes("OK ]"), "a ] inside a string must not close the array");
  assert.deepEqual(components[2].variants, ["a"]);
  assert.match(components[0].js, /querySelector/);
  assert.match(components[0].react, /export function Button/);
  assert.deepEqual(skipped, []);
});

test("extractDcDocs fails clearly when DOCS is absent or unterminated", () => {
  assert.throws(() => extractDcDocs("<html></html>"), /DOCS array not found/);
  assert.throws(() => findArrayEnd("[1, 2", 0), /does not close/);
});

test("extractDcDocs evaluates in an empty context with no globals", () => {
  const evil = "<script>\n  DOCS = [ { id: 'x', name: 'X', html: String(typeof process), css: String(typeof require) } ]\n</script>";
  const { components } = extractDcDocs(evil);
  assert.equal(components[0].html, "undefined");
  assert.equal(components[0].css, "undefined");
});

test("requiredTokens ignores properties the component defines itself", () => {
  const { components } = extractDcDocs(FIXTURE);
  // --fill is set inline by the markup, so only --success-base must come from the project.
  assert.deepEqual(requiredTokens(components[1]), ["--success-base"]);
  assert.deepEqual(allRequiredTokens(components), ["--primary-dark", "--primary-interactive", "--success-base"]);
});

test("classNames lists distinct classes in order", () => {
  assert.deepEqual(classNames('<a class="x y"><b class="y z"></b></a>'), ["x", "y", "z"]);
});

test("buildTokensCss reports tokens the palette does not define", () => {
  const { css, missing } = buildTokensCss({ name: "T", tokens: { "--primary-interactive": "#111" } }, ["--primary-interactive", "--primary-dark"]);
  assert.ok(css.includes("--primary-interactive: #111;"));
  assert.deepEqual(missing, ["--primary-dark"]);
});

test("buildComponentsCss puts the base layer before the component CSS", () => {
  const { buildComponentsCss, BASE_CSS } = require("../tools/ds-docs/dc-tokens");
  const out = buildComponentsCss([{ id: "button", name: "Button", css: ".btn{height:44px}" }]);
  assert.ok(out.startsWith(BASE_CSS));
  assert.ok(out.indexOf(".btn{display:inline-flex") < out.indexOf(".btn{height:44px}"), "component rules must come after, so they win");
  // :where() keeps the specificity at zero, so a prototype's own single-class link colour still wins.
  assert.match(out, /:where\(\.header,\.footer\) a\{color:inherit/);
});

test("buildComponentsCss appends palette overrides last, so they win over the source colours", () => {
  const { buildComponentsCss } = require("../tools/ds-docs/dc-tokens");
  const out = buildComponentsCss([{ id: "footer", name: "Footer", css: ".footer__legal{background:#050f22}" }], ".footer__legal{background:var(--neutral-body)}");
  assert.ok(out.lastIndexOf("var(--neutral-body)") > out.indexOf("#050f22"));
  assert.ok(!buildComponentsCss([{ id: "x", name: "X", css: ".x{}" }]).includes("Palette overrides"));
});

test("buildIndex is compact and names the palette, tokens and components", () => {
  const { components } = extractDcDocs(FIXTURE);
  const index = buildIndex(components, ["--primary-dark", "--danger-muted", "--unknown-token"], "T");
  assert.ok(index.includes("Palette: T"));
  assert.ok(index.includes("- button | Button | default · hover | classes: btn btn--primary"));
  assert.ok(index.includes("--primary-dark: hover and pressed state of primary actions"));
  assert.ok(index.includes("--danger-muted: danger status border"));
  assert.ok(/^--unknown-token$/m.test(index), "tokens without a known role are still listed");
});

test("run writes tokens, registry, editable showcase and synchronized artifact references", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-import-"));
  try {
    const source = path.join(dir, "ds.dc.html");
    fs.writeFileSync(source, FIXTURE);
    const full = path.join(dir, "full.json");
    fs.writeFileSync(full, JSON.stringify({ name: "T", tokens: { "--primary-interactive": "#1", "--primary-dark": "#2", "--success-base": "#3" } }));
    const relatedSource = path.join(dir, "prototype.dc.html");
    fs.writeFileSync(relatedSource, "<main>Button and Meter examples</main>");
    const relatedDir = path.join(dir, "projects", "p", "design", "prototypes", "app-inspection");
    fs.mkdirSync(relatedDir, { recursive: true });
    fs.writeFileSync(path.join(relatedDir, "proto.json"), JSON.stringify({ schema: 1, id: "app-inspection", screens: [], components: [], metadata: {} }));
    const ok = run({ source, palette: full, project: "p", out: dir, artifact: "ds-source", vitrine: "ds-inspection", title: "DS inspection", relatedPrototype: "app-inspection", relatedSource });
    assert.equal(ok.components, 3);
    assert.deepEqual(ok.missingTokens, []);
    const ds = path.join(dir, "projects", "p", "design", "ds");
    for (const rel of ["tokens.css", "components.css", "ds-index.md", "registry.json", "components/button/button.html", "components/button/button.css", "components/button/button.js", "components/button/button.angular.ts", "components/button/button.react.jsx"]) {
      assert.ok(fs.existsSync(path.join(ds, rel)), rel);
    }
    const registry = JSON.parse(fs.readFileSync(path.join(ds, "registry.json"), "utf8"));
    assert.deepEqual(registry.components["m57.button"].documentation, { prototypeId: "ds-inspection", screenId: "c-button" });
    assert.deepEqual(Object.keys(registry.components["m57.button"].implementations), ["vanilla", "angular", "react"]);
    assert.equal(registry.components["m57.button"].implementations.vanilla.files.length, 3);
    const showcase = JSON.parse(fs.readFileSync(path.join(dir, "projects", "p", "design", "prototypes", "ds-inspection", "proto.json"), "utf8"));
    assert.equal(showcase.screens.length, 13);
    assert.equal(showcase.metadata.runtime, "dc");
    assert.equal(showcase.components[0].id, "m57.button");
    const componentScreen = showcase.screens.find((screen) => screen.id === "c-button");
    assert.equal(componentScreen.snippets.length, 5);
    const dcDir = path.join(dir, "projects", "p", "design", "prototypes", "ds-inspection", "dc");
    const template = fs.readFileSync(path.join(dcDir, "template.html"), "utf8");
    const logic = fs.readFileSync(path.join(dcDir, "logic.js"), "utf8");
    const manifest = JSON.parse(fs.readFileSync(path.join(dcDir, "manifest.json"), "utf8"));
    assert.match(template, /Documentation shell/);
    assert.match(logic, /API_DOCS/);
    assert.deepEqual(manifest.screens, showcase.screens.map((screen) => screen.id));
    const related = JSON.parse(fs.readFileSync(path.join(relatedDir, "proto.json"), "utf8"));
    assert.deepEqual(related.components.map((component) => component.id), ["m57.button", "m57.meter"]);
    const design = JSON.parse(fs.readFileSync(path.join(dir, "projects", "p", "design", "design.json"), "utf8"));
    assert.deepEqual(design.components.map((component) => component.id), ["button", "meter", "chart"]);
    assert.equal(design.components[2].dsFolder, "design/ds/components/chart");
    assert.equal(design.components[0].sourceArtifact, "ds-source");
    const partial = path.join(dir, "partial.json");
    fs.writeFileSync(partial, JSON.stringify({ name: "T", tokens: { "--primary-interactive": "#1" } }));
    const bad = run({ source, palette: partial, project: "q", out: dir, dryRun: true });
    assert.deepEqual(bad.missingTokens, ["--primary-dark", "--success-base"]);
    assert.equal(fs.existsSync(path.join(dir, "projects", "q")), false, "dry run must not write");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

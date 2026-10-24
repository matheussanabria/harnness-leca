const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractDcDocs, classNames, requiredTokens, allRequiredTokens, findArrayEnd } = require("../tools/ds-docs/extract-dc");
const { buildTokensCss, buildIndex } = require("../tools/ds-docs/dc-tokens");
const { run } = require("../tools/import-dc-design-system");

// Same shape as a ".dc.html" Design System: a class field, brackets and quotes inside strings, one variant component.
const FIXTURE = `<html><script type="text/x-dc" data-dc-script>
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
}
</script></html>`;

test("extractDcDocs reads the DOCS class field and separates variant components", () => {
  const { components, skipped } = extractDcDocs(FIXTURE);
  assert.deepEqual(components.map((c) => c.id), ["button", "meter"]);
  assert.equal(components[0].desc, "Acao [primaria] do usuario.");
  assert.ok(components[0].html.includes("OK ]"), "a ] inside a string must not close the array");
  assert.deepEqual(skipped.map((s) => s.id), ["chart"]);
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

test("buildIndex is compact and names the palette, tokens and components", () => {
  const { components } = extractDcDocs(FIXTURE);
  const index = buildIndex(components, ["--primary-dark", "--danger-muted", "--unknown-token"], "T");
  assert.ok(index.includes("Palette: T"));
  assert.ok(index.includes("- button | Button | default · hover | classes: btn btn--primary"));
  assert.ok(index.includes("--primary-dark: hover and pressed state of primary actions"));
  assert.ok(index.includes("--danger-muted: danger status border"));
  assert.ok(/^--unknown-token$/m.test(index), "tokens without a known role are still listed");
});

test("run writes tokens, components, index and per-component files, and flags missing tokens", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-import-"));
  try {
    const source = path.join(dir, "ds.dc.html");
    fs.writeFileSync(source, FIXTURE);
    const full = path.join(dir, "full.json");
    fs.writeFileSync(full, JSON.stringify({ name: "T", tokens: { "--primary-interactive": "#1", "--primary-dark": "#2", "--success-base": "#3" } }));
    const ok = run({ source, palette: full, project: "p", out: dir });
    assert.equal(ok.components, 2);
    assert.deepEqual(ok.missingTokens, []);
    const ds = path.join(dir, "projects", "p", "design", "ds");
    for (const rel of ["tokens.css", "components.css", "ds-index.md", "components/button/button.html", "components/meter/meter.css"]) {
      assert.ok(fs.existsSync(path.join(ds, rel)), rel);
    }
    const partial = path.join(dir, "partial.json");
    fs.writeFileSync(partial, JSON.stringify({ name: "T", tokens: { "--primary-interactive": "#1" } }));
    const bad = run({ source, palette: partial, project: "q", out: dir, dryRun: true });
    assert.deepEqual(bad.missingTokens, ["--primary-dark", "--success-base"]);
    assert.equal(fs.existsSync(path.join(dir, "projects", "q")), false, "dry run must not write");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

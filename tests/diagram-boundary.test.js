// EP-21.03: structural rules of the diagram feature: where Mermaid may be imported, file size and no emojis.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WEB_SRC = path.join(__dirname, "..", "ui", "web", "src");
const FEATURE = path.join(WEB_SRC, "features", "diagram");

/** All .ts and .tsx files under a folder, as paths relative to ui/web/src with forward slashes. */
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) ? [path.relative(WEB_SRC, full).split(path.sep).join("/")] : [];
  });
}

const importsOf = (file, packageName) => {
  const text = fs.readFileSync(path.join(WEB_SRC, file), "utf8");
  const pattern = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|import\\s+)["']${packageName}(?:/[^"']*)?["']`);
  return pattern.test(text);
};

test("CP-07: no source imports the mermaid package except validate.ts and render.ts", () => {
  const importers = sources(WEB_SRC).filter((file) => importsOf(file, "mermaid")).sort();
  assert.deepEqual(importers, ["features/diagram/render.ts", "features/diagram/validate.ts"]);
});

test("DOMPurify is imported only by render.ts, and both imports are lazy (dynamic), per ADR-014 item 7", () => {
  assert.deepEqual(sources(WEB_SRC).filter((file) => importsOf(file, "dompurify")), ["features/diagram/render.ts"]);
  for (const file of ["validate.ts", "render.ts"]) {
    const text = fs.readFileSync(path.join(FEATURE, file), "utf8");
    assert.doesNotMatch(text, /^import\s[^;]*from\s+["'](mermaid|dompurify)["']/m, `${file} must not import it statically`);
    assert.match(text, /import\(["']mermaid["']\)/, `${file} loads mermaid on demand`);
  }
});

test("the secure Mermaid config of ADR-014 is in place and used by both modules", () => {
  const config = fs.readFileSync(path.join(FEATURE, "config.ts"), "utf8");
  for (const needle of ['securityLevel: "strict"', "htmlLabels: false", "startOnLoad: false"]) assert.ok(config.includes(needle), needle);
  for (const file of ["validate.ts", "render.ts"]) assert.match(fs.readFileSync(path.join(FEATURE, file), "utf8"), /ensureInitialized\(/, file);
  assert.doesNotMatch(config, /securityLevel: "(loose|antiscript|sandbox)"/);
});

test("every file of the feature stays within 250 lines and has no emoji", () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
  for (const file of fs.readdirSync(FEATURE).filter((name) => name.endsWith(".ts"))) {
    const text = fs.readFileSync(path.join(FEATURE, file), "utf8");
    assert.ok(text.split("\n").length <= 250, `${file} has more than 250 lines`);
    assert.doesNotMatch(text, emoji, `${file} has an emoji`);
  }
  const base = fs.readFileSync(path.join(WEB_SRC, "features", "canvas", "apiBase.ts"), "utf8");
  assert.ok(base.split("\n").length <= 250);
});

test("the feature has the modules the story names", () => {
  const files = fs.readdirSync(FEATURE).sort();
  for (const name of ["types.ts", "detect.ts", "validate.ts", "render.ts", "api.ts", "exportName.ts"]) assert.ok(files.includes(name), name);
});

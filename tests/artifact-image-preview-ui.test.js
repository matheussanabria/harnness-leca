const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "ui/public/js/modules/design-artifacts-preview.js"), "utf8");
const css = fs.readFileSync(path.join(root, "ui/public/css/design/19-artifact-preview.css"), "utf8");

test("image preview: fallback for unsupported formats, zoom and open-in-tab", () => {
  assert.match(js, /data-artifact-image-el/);
  assert.match(js, /addEventListener\("error", showError/);
  assert.match(js, /data-artifact-image-zoom/);
  assert.match(js, /target="_blank" rel="noopener noreferrer"/);
  assert.match(css, /\.artifact-preview-image\.is-actual-size/);
  assert.match(css, /\.artifact-preview-image-error/);
});

test("image preview: no emoji, FontAwesome icons only", () => {
  assert.doesNotMatch(js + css, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.match(js, /fa-magnifying-glass-plus/);
});

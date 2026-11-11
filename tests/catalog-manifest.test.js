const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = (f) => import(pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "catalogo", f)).href);

test("parseManifest reads flat keys and keeps folded lines", async () => {
  const { parseManifest } = await load("catalogo-manifest.js");
  const rows = parseManifest("name: qa\ndescription: First\n  second\ntools: Read, Edit\nmodel: inherit");
  assert.deepEqual(rows.map((r) => r.key), ["name", "description", "tools", "model"]);
  assert.equal(rows[1].value, "First second");
});

test("renderManifest escapes values and splits tools into chips", async () => {
  const { renderManifest } = await load("catalogo-manifest.js");
  const html = renderManifest("name: <b>x</b>\ntools: Read, Bash");
  assert.ok(!html.includes("<b>x</b>"));
  assert.equal((html.match(/k-tag/g) || []).length, 2);
  assert.equal(renderManifest(""), "");
});

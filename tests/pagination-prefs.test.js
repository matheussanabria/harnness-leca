// @ts-check
// Tests for the global page-size preferences (screen `lists`).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULES = path.resolve("ui", "public", "js");
const load = (rel) => import(pathToFileURL(path.join(MODULES, rel)).href);

test("hydrate reads the lists screen and exposes the sizes synchronously", async () => {
  const { createPageSizePrefs } = await load("shared/pagination-prefs.js");
  const { getPageSize } = await load("shared/pagination.js");
  const reads = [];
  const prefs = createPageSizePrefs({
    loadScreen: async (id) => {
      reads.push(id);
      return { pageSizes: { hydrate: 25, other: 10, broken: 7, wrong: "50" } };
    },
    patchScreen: async () => {},
  });

  await prefs.hydrate();

  assert.deepEqual(reads, ["lists"]);
  assert.equal(getPageSize("hydrate"), 25);
  assert.equal(getPageSize("other"), 10);
  assert.equal(getPageSize("broken"), 5, "size outside the presets falls back to the default");
  assert.equal(getPageSize("wrong"), 5, "non numeric sizes are dropped");
  assert.equal(getPageSize("unknown"), 5);
  assert.equal(prefs.size("hydrate"), 25);
  assert.deepEqual(prefs.sizes(), { hydrate: 25, other: 10 });

  await prefs.hydrate();
  assert.deepEqual(reads, ["lists"], "hydrate is not repeated");
});

test("save writes the preset through patchScreen and keeps the other keys", async () => {
  const { createPageSizePrefs } = await load("shared/pagination-prefs.js");
  const { getPageSize } = await load("shared/pagination.js");
  const writes = [];
  const prefs = createPageSizePrefs({
    loadScreen: async () => ({ pageSizes: { saved: 10, kept: 25 } }),
    patchScreen: async (id, patch) => { writes.push([id, patch]); },
  });

  await prefs.saveSize("saved", 50);
  assert.deepEqual(writes, [["lists", { pageSizes: { saved: 50, kept: 25 } }]]);
  assert.equal(getPageSize("saved"), 50);
  assert.equal(getPageSize("kept"), 25);

  await prefs.saveSize("saved", 7);
  assert.equal(getPageSize("saved"), 5, "only presets are accepted");
  assert.deepEqual(writes.at(-1), ["lists", { pageSizes: { saved: 5, kept: 25 } }]);
});

test("cleanPageSizes keeps only integer preset values", async () => {
  const { cleanPageSizes } = await load("shared/pagination-prefs.js");
  assert.deepEqual(cleanPageSizes({ a: 5, b: 10, c: 25, d: 50 }), { a: 5, b: 10, c: 25, d: 50 });
  assert.deepEqual(cleanPageSizes({ a: 6, b: "10", c: null, d: 5.5 }), {});
  assert.deepEqual(cleanPageSizes(null), {});
  assert.deepEqual(cleanPageSizes([5, 10]), {});
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { renderStoryFilesPanel, sortStories } from "../ui/public/js/modules/design-layers/layers-story-files.js";

const require = createRequire(import.meta.url);
const { readStoryFiles, REL_PATH } = require("../ui/server/services/story-files.service.js");

function repoWith(json) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "story-files-"));
  if (json !== undefined) {
    fs.mkdirSync(path.dirname(path.join(root, REL_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, REL_PATH), typeof json === "string" ? json : JSON.stringify(json));
  }
  return root;
}

const SAMPLE = {
  geradoEm: "2026-11-11T12:00:00.000Z",
  repos: ["api", "web"],
  semChave: 3,
  historias: {
    "DIS-443": { titulos: ["Integracao"], commits: 4, repos: { api: [{ path: "a/One.java", commits: 2, ultimo: "x" }], web: [] } },
    "DIS-506": { titulos: ["Autorizacao"], commits: 1, repos: { api: [{ path: "a/Perm.java", commits: 1 }] } },
  },
};

test("readStoryFiles reports a missing file without failing", () => {
  const r = readStoryFiles(repoWith());
  assert.equal(r.found, false);
  assert.equal(r.file, REL_PATH);
});

test("readStoryFiles reports invalid JSON as an error message", () => {
  const r = readStoryFiles(repoWith("{ nao e json"));
  assert.equal(r.found, false);
  assert.match(r.error, /JSON invalido/);
});

test("readStoryFiles keeps only well-formed stories and known fields", () => {
  const r = readStoryFiles(repoWith({ ...SAMPLE, historias: { ...SAMPLE.historias, "<script>": { commits: 9 }, "DIS-1": null } }));
  assert.equal(r.found, true);
  assert.deepEqual(Object.keys(r.historias).sort(), ["DIS-443", "DIS-506"]);
  assert.deepEqual(r.historias["DIS-443"].repos.api, [{ path: "a/One.java", commits: 2 }]);
});

test("sortStories orders by commits and sends the placeholder key last on ties", () => {
  const order = sortStories({ "DIS-XXX": { commits: 2 }, "DIS-506": { commits: 2 }, "DIS-443": { commits: 5 } }).map(([k]) => k);
  assert.deepEqual(order, ["DIS-443", "DIS-506", "DIS-XXX"]);
});

test("panel shows counts, files per repo and escapes HTML", () => {
  const data = { found: true, geradoEm: SAMPLE.geradoEm, semChave: 3, historias: { "DIS-443": { titulos: ["<b>x</b>"], commits: 4, repos: { api: [{ path: "a/One.java", commits: 2 }] } } } };
  const html = renderStoryFilesPanel(data);
  assert.match(html, /DIS-443/);
  assert.match(html, /4 commits/);
  assert.match(html, /1 arquivos/);
  assert.match(html, /a\/One\.java/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /3 commits sem chave/);
});

test("panel explains how to generate the file when it does not exist", () => {
  const html = renderStoryFilesPanel({ found: false });
  assert.match(html, /rastreio-historias/);
  assert.equal(renderStoryFilesPanel(null), "");
});

test("the real generated file for saude/dispensacao loads when present", { skip: !fs.existsSync(path.join(os.homedir(), "git/saude/dispensacao", REL_PATH)) }, () => {
  const r = readStoryFiles(path.join(os.homedir(), "git/saude/dispensacao"));
  assert.equal(r.found, true);
  assert.ok(Object.keys(r.historias).length >= 10);
});

test("loadStoryFiles fills the store, and never throws when the request fails", async () => {
  const { loadStoryFiles } = await import("../ui/public/js/modules/design-layers/layers-story-files.js");
  const { dls } = await import("../ui/public/js/modules/design-layers-store.js");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({ ok: true, json: async () => ({ found: true, url }) });
    await loadStoryFiles("meu projeto");
    assert.equal(dls.storyFiles.found, true);
    assert.match(dls.storyFiles.url, /meu%20projeto\/design\/story-files$/);
    globalThis.fetch = async () => ({ ok: false });
    await loadStoryFiles("x");
    assert.equal(dls.storyFiles, null);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await loadStoryFiles("x");
    assert.equal(dls.storyFiles, null);
  } finally {
    globalThis.fetch = original;
  }
});

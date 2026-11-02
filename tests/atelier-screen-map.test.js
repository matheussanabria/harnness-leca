// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractRawLinks, buildScreenMap } = require("../ui/server/services/atelier-screen-map.service");
const { loadScreenMap } = require("../ui/server/services/atelier-screen-map-disk.service");

const screen = (/** @type {string} */ id, html = "") => ({ id, html });
const manifest = (/** @type {string[]} */ ...ids) => ({ screens: ids.map((id) => ({ id })) });

test("extractRawLinks reads goto actions and anchor hrefs in document order", () => {
  const html = `<a href="b.html">b</a><button data-action="goto:c">c</button><a href='#'>x</a><a class="k" href="https://x.io">e</a>`;
  assert.deepEqual(extractRawLinks(html), [
    { raw: "b.html", via: "href" },
    { raw: "goto:c", via: "action" },
    { raw: "#", via: "href" },
    { raw: "https://x.io", via: "href" },
  ]);
});

test("maps screens, links, missing targets and orphans", async () => {
  const m = await buildScreenMap({
    protoId: "p",
    manifest: manifest("home", "list", "lonely"),
    files: [
      screen("home", `<a href="#" data-action="goto:list">l</a><a href="./screens/ghost.html">g</a>`),
      screen("list", `<a data-action="goto:home">h</a><a data-action="goto:list">self</a>`),
      screen("lonely", `<a data-action="goto:home">h</a>`),
    ],
  });
  assert.equal(m.entry, "home");
  assert.deepEqual(m.links.map((l) => `${l.from}>${l.to}:${l.via}`), ["home>list:action", "home>ghost:href", "list>home:action", "list>list:action", "lonely>home:action"]);
  assert.deepEqual(m.missingTargets.map((l) => `${l.from}>${l.to}`), ["home>ghost"]);
  assert.deepEqual(m.orphans, ["lonely"], "a self link does not make a screen reachable");
  assert.equal(m.ok, false);
  assert.deepEqual(m.screens.find((s) => s.id === "list")?.out, ["home", "list"]);
  assert.equal(m.screens.find((s) => s.id === "home")?.inCount, 2);
});

test("external links and bare anchors are not screen links", async () => {
  const m = await buildScreenMap({ manifest: manifest("a"), files: [screen("a", `<a href="https://x.io">e</a><a href="#top">t</a><a href="javascript:void(0)">j</a>`)] });
  assert.equal(m.links.length, 0);
  assert.deepEqual(m.external.map((l) => l.to), ["https://x.io"]);
  assert.equal(m.ok, true);
});

test("registered without file and file without registration are reported", async () => {
  const m = await buildScreenMap({ manifest: manifest("a", "b"), files: [screen("a", `<a data-action="goto:c">c</a>`), screen("c", `<a data-action="goto:a">a</a>`)] });
  assert.deepEqual(m.missingFiles, ["b"]);
  assert.deepEqual(m.unregistered, ["c"]);
  assert.deepEqual(m.orphans, ["b"]);
  assert.equal(m.screens.find((s) => s.id === "b")?.onDisk, false);
});

test("entry comes from manifest.entry when valid, else the first screen; no manifest uses the disk", async () => {
  const files = [screen("b", `<a data-action="goto:a">a</a>`), screen("a")];
  assert.equal((await buildScreenMap({ manifest: { ...manifest("a", "b"), entry: "b" }, files })).entry, "b");
  assert.equal((await buildScreenMap({ manifest: { ...manifest("a", "b"), entry: "zzz" }, files })).entry, "a");
  const bare = await buildScreenMap({ manifest: null, files });
  assert.deepEqual(bare.screens.map((s) => s.id), ["a", "b"]);
  assert.equal(bare.screens.every((s) => !s.registered), true);
});

test("empty prototype and input are untouched", async () => {
  const m = await buildScreenMap({ manifest: null, files: [] });
  assert.deepEqual([m.screens, m.links, m.orphans, m.missingTargets], [[], [], [], []]);
  const files = [screen("a", `<a data-action="goto:b">b</a>`)];
  const copy = JSON.stringify(files);
  await buildScreenMap({ manifest: manifest("a"), files });
  assert.equal(JSON.stringify(files), copy);
});

test("loadScreenMap reads proto.json and screens from disk; missing prototype is empty", async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "screen-map-"));
  const dir = path.join(projectDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(dir, "screens"), { recursive: true });
  fs.writeFileSync(path.join(dir, "proto.json"), JSON.stringify(manifest("home", "next")));
  fs.writeFileSync(path.join(dir, "screens", "home.html"), `<a data-action="goto:next">n</a>`);
  fs.writeFileSync(path.join(dir, "screens", "next.html"), `<a href="home.html">h</a>`);
  const m = await loadScreenMap({ projectDir, protoId: "p1" });
  assert.equal(m.ok, true);
  assert.deepEqual(m.links.map((l) => `${l.from}>${l.to}`), ["home>next", "next>home"]);
  const none = await loadScreenMap({ projectDir, protoId: "nope" });
  assert.deepEqual(none.screens, []);
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildProtoMap, MAX_MAP_CHARS } = require("../ui/server/services/atelier-proto-map.service");
const { extractNavTargets, navGraph } = require("../ui/server/services/atelier-nav-contract.service");
const { buildProtoContext } = require("../ui/server/services/atelier-proto-context.service");

const tokens = (/** @type {string} */ t) => Math.ceil(t.length / 4);

function makeProto(extra = {}) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-map-"));
  const dir = path.join(projectDir, "design", "prototypes", "p1");
  fs.mkdirSync(path.join(dir, "screens"), { recursive: true });
  fs.mkdirSync(path.join(dir, "styles"), { recursive: true });
  fs.writeFileSync(path.join(dir, "proto.json"), JSON.stringify({ screens: [{ id: "home" }], components: [{ id: "card" }] }));
  fs.writeFileSync(path.join(dir, "screens", "home.html"), `<a href="#" data-action="goto:produtos">p</a><a data-action="goto:ghost">g</a><script>localStorage.getItem("inv:produtos")</script>`);
  fs.writeFileSync(path.join(dir, "screens", "produtos.html"), `<a data-action="goto:home">h</a>`);
  fs.writeFileSync(path.join(dir, "styles", "proto.css"), ".chip{color:red}.chip:hover{color:blue}.toolbar{display:flex}");
  for (const [f, c] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), String(c));
  return { projectDir, dir };
}

test("extractNavTargets dedups and ignores plain hrefs", () => {
  assert.deepEqual(extractNavTargets(`<a data-action="goto:a"></a><a data-action='goto:b'></a><a data-action="goto:a"></a><a href="x.html"></a>`), ["a", "b"]);
});

test("navGraph reports edges and broken targets", () => {
  const g = navGraph([{ id: "a", html: `<i data-action="goto:b"></i><i data-action="goto:zz"></i>` }, { id: "b", html: "" }]);
  assert.equal(g.edges, "a>b,zz");
  assert.equal(g.broken, "a>zz");
});

test("map lists screens, nav, broken nav, storage, classes and components", () => {
  const { projectDir } = makeProto();
  const out = buildProtoContext({ projectDir, protoId: "p1" });
  assert.match(out, /^## Prototype map "p1" \| hash [0-9a-f]{12}/);
  assert.match(out, /Nav: home>produtos,ghost; produtos>home/);
  assert.match(out, /Broken nav \(target missing\): home>ghost/);
  assert.match(out, /Storage: inv:produtos/);
  assert.match(out, /CSS classes \(2\): \.chip \.toolbar/);
  assert.match(out, /Components: card/);
});

test("hash is stable, and changes with a screen, the CSS or the registered screens", () => {
  const hashOf = (/** @type {string} */ projectDir) => /hash ([0-9a-f]{12})/.exec(buildProtoContext({ projectDir, protoId: "p1" }))?.[1];
  const a = makeProto();
  assert.equal(hashOf(a.projectDir), hashOf(a.projectDir));
  const base = hashOf(a.projectDir);
  fs.appendFileSync(path.join(a.dir, "screens", "home.html"), " ");
  const afterScreen = hashOf(a.projectDir);
  assert.notEqual(afterScreen, base);
  fs.appendFileSync(path.join(a.dir, "styles", "proto.css"), ".x{}");
  const afterCss = hashOf(a.projectDir);
  assert.notEqual(afterCss, afterScreen);
  fs.writeFileSync(path.join(a.dir, "proto.json"), JSON.stringify({ screens: [{ id: "home" }, { id: "produtos" }] }));
  assert.notEqual(hashOf(a.projectDir), afterCss);
});

test("map stays under 300 tokens even for a large prototype", () => {
  const screens = Array.from({ length: 30 }, (_, i) => ({ id: `screen-${i}`, html: `<i data-action="goto:screen-${(i + 1) % 30}"></i><i data-action="goto:missing-${i}"></i>localStorage.getItem("key:${i}")` }));
  const css = Array.from({ length: 200 }, (_, i) => `.class-name-${i}{a:b}`).join("");
  const { text } = buildProtoMap({
    protoId: "big", screens, css, registered: [], storage: screens.map((_, i) => `key:${i}`), components: Array.from({ length: 20 }, (_, i) => `comp-${i}`),
  });
  assert.ok(text.length <= MAX_MAP_CHARS);
  assert.ok(tokens(text) < 300, `map is ${tokens(text)} tokens`);
});

test("typical map is well under budget and the added cost is reported", () => {
  const { projectDir } = makeProto();
  const full = buildProtoContext({ projectDir, protoId: "p1" });
  const map = full.split("\n\n")[0];
  assert.ok(tokens(map) < 150, `typical map is ${tokens(map)} tokens`);
  assert.ok(full.includes(map));
});

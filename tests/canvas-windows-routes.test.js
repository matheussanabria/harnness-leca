// EP-25.12: the Canvas windows open the SPA straight on their view, in the scope chosen in the launcher.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const routerUrl = pathToFileURL(path.join(__dirname, "..", "ui", "public", "js", "shared", "router.js")).href;
const modelUrl = pathToFileURL(path.join(__dirname, "..", "ui", "web", "src", "features", "launcher", "model.ts")).href;

test("each clean address maps to its Canvas view, with or without a trailing slash", async () => {
  const { routeFromLocation, VIEW_SCREENS } = await import(routerUrl);
  const cases = { "/quadro-livre": "canvas-board", "/mapa-mental": "canvas-mindmap", "/diagramas/": "canvas-diagram" };
  for (const [pathname, screen] of Object.entries(cases)) {
    assert.deepEqual(routeFromLocation({ pathname, hash: "", search: "?p=_pessoal" }), { screen, params: [] }, pathname);
    assert.ok(VIEW_SCREENS.includes(screen), screen);
  }
});

test("a hash route still wins over the address, and other addresses are untouched", async () => {
  const { routeFromLocation } = await import(routerUrl);
  assert.deepEqual(routeFromLocation({ pathname: "/quadro-livre", hash: "#/canvas-mindmap/abc", search: "" }), { screen: "canvas-mindmap", params: [] });
  assert.equal(routeFromLocation({ pathname: "/", hash: "", search: "" }), null);
  assert.equal(routeFromLocation({ pathname: "/consumo", hash: "", search: "" }), null);
});

test("the static server serves the SPA shell for the three clean addresses", () => {
  const src = require("node:fs").readFileSync(path.join(__dirname, "..", "ui", "server", "controllers", "static.controller.js"), "utf8");
  assert.match(src, /CANVAS_PAGES = \["\/quadro-livre", "\/mapa-mental", "\/diagramas"\]/);
  assert.match(src, /CANVAS_PAGES\.includes\(p\)\) \? "index\.html"/);
});

test("the launcher puts the scope in the URL only for pages that need it", async () => {
  const { openUrl } = await import(modelUrl);
  const board = { rota: "/quadro-livre", escopoNaUrl: true };
  assert.equal(openUrl(board, null), "/quadro-livre?p=_pessoal");
  assert.equal(openUrl(board, "meus-treinos"), "/quadro-livre?p=meus-treinos");
  assert.equal(openUrl({ rota: "/consumo" }, "alfa"), "/consumo");
});

test("the manifest routes of the three Canvas windows are the ones the router knows", async () => {
  const { CANVAS_PATHS } = await import(routerUrl);
  const { FEATURES } = require("../ui/server/features/manifest");
  for (const id of ["quadro-livre", "mapa-mental", "diagramas"]) {
    const feature = FEATURES.find((f) => f.id === id);
    assert.ok(CANVAS_PATHS[feature.rota], id);
  }
});

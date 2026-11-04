// @ts-check
// Hash routes for the app screens: parsing, building, history handling, route application and wiring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const { APP_SCREENS, VIEW_SCREENS, parseRoute, buildRoute, legacyRoute, routeFromLocation, sameRoute, createRouter } =
  await import("../ui/public/js/shared/router.js");
const { createRouteApplier } = await import("../ui/public/js/modules/route-apply.js");

test("every app screen round-trips through buildRoute and parseRoute", () => {
  for (const screen of APP_SCREENS) {
    assert.deepEqual(parseRoute(buildRoute(screen)), { screen, params: [] }, screen);
  }
  assert.deepEqual(parseRoute(buildRoute("prototypes", ["dis-fluxo", "home"])), { screen: "prototypes", params: ["dis-fluxo", "home"] });
  assert.equal(buildRoute("prototypes", ["a", "b"]), "#/prototypes/a/b");
});

test("empty or unknown hashes mean the conversations screen", () => {
  for (const hash of ["", "#", "#/", "#/nada", "#/../etc/passwd", "#/scrum%ZZ"]) {
    const route = parseRoute(hash);
    assert.ok(route.screen === "chats" || route.screen === "scrum", hash);
  }
  assert.deepEqual(parseRoute("#/nada"), { screen: "chats", params: [] });
  assert.deepEqual(parseRoute(""), { screen: "chats", params: [] });
});

test("only the Atelier takes parameters, at most two, and unsafe segments are dropped", () => {
  assert.deepEqual(parseRoute("#/scrum/extra"), { screen: "scrum", params: [] });
  assert.deepEqual(parseRoute("#/prototypes/a/b/c"), { screen: "prototypes", params: ["a", "b"] });
  assert.deepEqual(parseRoute("#/prototypes/%3Cscript%3E/home"), { screen: "prototypes", params: [] });
  assert.equal(buildRoute("prototypes", ["ok", "x/../y"]), "#/prototypes/ok");
  assert.equal(buildRoute("inexistente"), "#/chats");
});

test("old ?view= and ?module= links map to routes; a hash route wins over them", () => {
  assert.deepEqual(legacyRoute("?view=board"), { screen: "board", params: [] });
  assert.deepEqual(legacyRoute("?module=studio"), { screen: "studio", params: [] });
  assert.deepEqual(legacyRoute("?module=design"), { screen: "scrum", params: [] });
  assert.equal(legacyRoute("?view=nope"), null);
  assert.equal(legacyRoute(""), null);
  assert.deepEqual(routeFromLocation({ hash: "#/audit", search: "?view=board" }), { screen: "audit", params: [] });
  assert.deepEqual(routeFromLocation({ hash: "", search: "?view=board" }), { screen: "board", params: [] });
  assert.equal(routeFromLocation({ hash: "", search: "?p=demo" }), null);
  assert.equal(sameRoute({ screen: "a", params: ["x"] }, { screen: "a", params: ["x"] }), true);
  assert.equal(sameRoute({ screen: "a", params: ["x"] }, { screen: "a", params: [] }), false);
});

function fakeEnv(hash = "") {
  const calls = [];
  const handlers = {};
  const env = {
    location: { hash, pathname: "/", search: "?p=demo" },
    history: {
      pushState: (_s, _t, url) => { calls.push(["push", url]); env.location.hash = url.slice(url.indexOf("#")); },
      replaceState: (_s, _t, url) => { calls.push(["replace", url]); env.location.hash = url.slice(url.indexOf("#")); },
    },
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  return { env, calls, fire: () => handlers.hashchange() };
}

test("navigate keeps ?p=, pushes or replaces, and does nothing when already there", () => {
  const { env, calls } = fakeEnv();
  const router = createRouter(/** @type {any} */ (env));
  assert.equal(router.navigate("scrum", [], { push: true }), true);
  assert.deepEqual(calls.at(-1), ["push", "/?p=demo#/scrum"]);
  assert.equal(router.navigate("scrum", [], { push: true }), false, "same screen: no new history entry");
  assert.equal(router.navigate("prototypes", ["a", "home"]), true);
  assert.deepEqual(calls.at(-1), ["replace", "/?p=demo#/prototypes/a/home"]);
  assert.equal(calls.length, 2);
  assert.equal(router.navigate("chats"), true);
  assert.equal(router.navigate("chats"), false);
  assert.deepEqual(router.current(), { screen: "chats", params: [] });
});

test("an empty hash already counts as the conversations screen", () => {
  const { env, calls } = fakeEnv("");
  const router = createRouter(/** @type {any} */ (env));
  assert.equal(router.navigate("chats"), false);
  assert.equal(calls.length, 0);
});

test("Back/Forward (hashchange) notifies listeners with the parsed route, and listeners can be removed", () => {
  const { env, fire } = fakeEnv("#/layers");
  const router = createRouter(/** @type {any} */ (env));
  const seen = [];
  const off = router.onChange((route) => seen.push(route));
  fire();
  env.location.hash = "#/prototypes/p1/home";
  fire();
  off();
  fire();
  assert.deepEqual(seen, [{ screen: "layers", params: [] }, { screen: "prototypes", params: ["p1", "home"] }]);
});

function applier(state = {}) {
  const log = [];
  const designMod = {
    toggleDesignMode: (force, view) => { log.push(["design", force, view]); state.design = Boolean(force); },
    setDesignView: (view) => log.push(["view", view]),
  };
  const studioMod = { toggleStudioMode: (force) => { log.push(["studio", force]); state.studio = Boolean(force); } };
  const apply = createRouteApplier({
    designMod, studioMod,
    prepareAtelier: (proto, screen) => log.push(["prepare", proto, screen]),
    isDesignOpen: () => Boolean(state.design),
    isStudioOpen: () => Boolean(state.studio),
  });
  return { apply, log, state };
}

test("applying a view route opens Design on that view, or just switches when Design is already open", async () => {
  const closed = applier();
  await closed.apply({ screen: "board", params: [] });
  assert.deepEqual(closed.log, [["design", true, "board"]]);
  const open = applier({ design: true });
  await open.apply({ screen: "audit", params: [] });
  assert.deepEqual(open.log, [["view", "audit"]]);
});

test("a prototype route prepares the Atelier before opening it", async () => {
  const { apply, log } = applier();
  await apply({ screen: "prototypes", params: ["dis-fluxo", "home"] });
  assert.deepEqual(log, [["prepare", "dis-fluxo", "home"], ["design", true, "prototypes"]]);
  const none = applier();
  await none.apply({ screen: "prototypes", params: [] });
  assert.deepEqual(none.log, [["design", true, "prototypes"]]);
});

test("studio and conversations routes open and close the right workspace", async () => {
  const studio = applier();
  await studio.apply({ screen: "studio", params: [] });
  assert.deepEqual(studio.log, [["studio", true]]);
  const back = applier({ studio: true, design: true });
  await back.apply({ screen: "chats", params: [] });
  assert.deepEqual(back.log, [["studio", false], ["design", false, undefined]]);
  const idle = applier();
  await idle.apply({ screen: "chats", params: [] });
  assert.deepEqual(idle.log, []);
});

test("the screen switchers report their route and the boot reads it before the saved state", () => {
  assert.match(read("ui/public/js/modules/design-view-state.js"), /routeTo\(view/);
  assert.match(read("ui/public/js/modules/studio-core.js"), /routeTo\("studio"/);
  assert.match(read("ui/public/js/modules/prototype-atelier-adoption.js"), /routeTo\("prototypes"/);
  const app = read("ui/public/js/app.js");
  assert.match(app, /routeFromLocation\(location\)/);
  assert.match(app, /getRouter\(\)\?\.onChange/);
  assert.ok(app.indexOf("routeFromLocation") < app.indexOf("restoredDesignState()"), "route first, saved state as fallback");
});

test("the registry declares the real addresses and they parse back to their own screen", () => {
  const registry = createRequire(import.meta.url)("../ui/server/services/screen-state/registry");
  for (const id of VIEW_SCREENS) {
    const entry = registry.getScreen(id);
    const hash = entry.rota.slice(entry.rota.indexOf("#"));
    assert.equal(parseRoute(hash.replace("<protoId>", "p").replace("<screen>", "home")).screen, id, id);
  }
  assert.equal(registry.getScreen("chats").rota.endsWith("#/chats"), true);
  for (const id of ["overview", "office", "deploy", "diario"]) assert.equal(registry.getScreen(id).rota.includes("#"), false, id);
});

function islandApplier(state = {}) {
  const log = [];
  const designMod = {
    toggleDesignMode: (force, view) => { log.push(["design", force, view]); state.design = Boolean(force); },
    setDesignView: (view) => log.push(["view", view]),
  };
  const studioMod = { toggleStudioMode: (force) => { log.push(["studio", force]); state.studio = Boolean(force); } };
  const apply = createRouteApplier({
    designMod, studioMod,
    isDesignOpen: () => Boolean(state.design),
    isStudioOpen: () => Boolean(state.studio),
    islands: {
      mount: (name, props) => { log.push(["islands.mount", name, props]); return true; },
      unmount: () => log.push(["islands.unmount"]),
    },
    getSlug: () => "demo",
  });
  return { apply, log, state };
}

test("lab routes parse with two parameters and build back to their own address", () => {
  assert.deepEqual(parseRoute("#/lab/a/b"), { screen: "lab", params: ["a", "b"] });
  assert.equal(buildRoute("lab", ["x"]), "#/lab/x");
});

test("canvas-board route takes one optional board id", () => {
  assert.deepEqual(parseRoute("#/canvas-board"), { screen: "canvas-board", params: [] });
  assert.deepEqual(parseRoute("#/canvas-board/abc/extra"), { screen: "canvas-board", params: ["abc"] });
  assert.equal(buildRoute("canvas-board", ["abc"]), "#/canvas-board/abc");
});

test("an island route mounts after closing workspaces, and leaving unmounts before Design opens", async () => {
  const run = islandApplier({ studio: true, design: true });
  await run.apply({ screen: "lab", params: ["p"] });
  assert.deepEqual(run.log, [
    ["studio", false],
    ["design", false, undefined],
    ["islands.mount", "lab", { slug: "demo", params: ["p"] }],
  ]);
  run.log.length = 0;
  await run.apply({ screen: "scrum", params: [] });
  assert.deepEqual(run.log, [["islands.unmount"], ["design", true, "scrum"]]);
});

test("new files stay small and use no emoji", () => {
  for (const rel of ["ui/public/js/shared/router.js", "ui/public/js/modules/route-apply.js"]) {
    const text = read(rel);
    assert.ok(text.split("\n").length <= 300, rel);
    assert.equal(/\p{Extended_Pictographic}/u.test(text), false, rel);
  }
});

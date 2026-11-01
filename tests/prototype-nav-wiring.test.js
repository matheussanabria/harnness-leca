// @ts-check
// EP-16.02: the exported runtime resolves link targets like the ESM resolver, tabs keep working, and render falls back to the first screen.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { makeTempDir } = require("./helpers/temp-dir");
const { generateRuntimeJs } = require("../ui/server/services/prototype-exporter-runtime.service");
const { compileSingleHtmlPrototype } = require("../ui/server/services/prototype-exporter.service");
const { renderPrototypeScreen } = require("../ui/server/services/prototype-renderer.service");

const SCREENS = ["home", "orbit"];
const loadResolver = () => import(pathToFileURL(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-nav-resolve.js")).href);

/** Runs the embedded runtime against a stub DOM and returns what a click on `el` did. */
function click(el) {
  /** @type {Function | null} */
  let handler = null;
  const shown = [];
  const warnings = [];
  const panels = SCREENS.map((id) => ({ id: `screen-${id}`, style: {} }));
  const doc = {
    addEventListener: (_type, fn) => { handler = fn; },
    querySelectorAll: (sel) => (sel === ".proto-screen-panel" ? panels : []),
    getElementById: (id) => { const p = panels.find((x) => x.id === id); if (p) shown.push(id); return p || null; },
    querySelector: () => ({ appendChild: (w) => warnings.push(w.textContent), querySelector: () => null }),
    createElement: () => ({ style: {}, remove() {} }),
  };
  const win = {};
  new Function("document", "window", "setTimeout", generateRuntimeJs(SCREENS))(doc, win, () => 0);
  let prevented = false;
  assert.ok(handler, "the runtime registers a click handler");
  handler({ target: { closest: (sel) => el[sel] || null }, preventDefault: () => { prevented = true; } });
  return { shown, warnings, prevented, exposesShowScreen: typeof win.showScreen === "function" };
}

const link = (href) => ({ "a[href]": { getAttribute: () => href } });
const action = (value) => ({ "[data-action]": { getAttribute: () => value } });

test("embedded runtime agrees with the ESM resolver on every link format", async () => {
  const { resolveScreenTarget } = await loadResolver();
  const hrefs = ["screens/orbit.html", "./screens/orbit.html#x", "orbit.html?a=1", "orbit", "screens/nope.html", "https://x.com", "mailto:a@b.c", "#sec", "javascript:void(0)"];
  for (const href of hrefs) {
    const expected = resolveScreenTarget(href, SCREENS);
    const got = click(link(href));
    if (expected.kind === "screen") assert.deepEqual(got.shown, [`screen-${expected.screen}`], href);
    else assert.deepEqual(got.shown, [], href);
    assert.equal(got.warnings.length, expected.kind === "planned" ? 1 : 0, href);
    assert.equal(got.prevented, expected.kind === "screen" || expected.kind === "planned", href);
  }
});

test("data-action goto still switches the screen and the tab buttons keep their global", () => {
  const got = click(action("goto:orbit"));
  assert.deepEqual(got.shown, ["screen-orbit"]);
  assert.equal(got.exposesShowScreen, true);
});

function fixture(screens) {
  const dir = makeTempDir("harness-nav-", test);
  const proto = path.join(dir, "design", "prototypes", "p");
  fs.mkdirSync(path.join(proto, "screens"), { recursive: true });
  for (const id of screens) fs.writeFileSync(path.join(proto, "screens", `${id}.html`), `<main><a href="screens/${screens.at(-1)}.html">go</a></main>`);
  fs.writeFileSync(path.join(proto, "proto.json"), JSON.stringify({ id: "p", title: "P", screens: screens.map((id) => ({ id, file: `screens/${id}.html` })) }));
  return dir;
}

test("exported HTML carries the runtime, resolves every screen and has no emoji", () => {
  const html = compileSingleHtmlPrototype(fixture(["home", "orbit"]), "", "p");
  assert.match(html, /Prototype export runtime \(EP-16\.02\)/);
  assert.match(html, /var knownScreens = \["home","orbit"\]/);
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
});

test("render without a screen id opens the first screen instead of forcing home", () => {
  const dir = fixture(["inicio", "detalhe"]);
  const result = renderPrototypeScreen(dir, dir, "p", undefined, {});
  assert.equal(result.ok, true);
  assert.match(result.html, /data-screen="inicio"/);
  const controller = fs.readFileSync(path.resolve(__dirname, "..", "ui", "server", "controllers", "prototype.controller.js"), "utf8");
  assert.doesNotMatch(controller, /screenId \|\| "home"/);
});

test("bridge link script sends raw targets for screen links and leaves other clicks alone", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "ui", "public", "js", "modules", "prototype-bridge-links.js"), "utf8");
  const sent = [];
  const win = { top: {}, __harnessBridge: { send: (type, payload) => sent.push([type, payload]) } };
  new Function("window", src)(win);
  const handle = (href, { mode = "play", inAction = false } = {}) => {
    let prevented = false;
    const link = { getAttribute: () => href };
    const target = { closest: (sel) => (sel === "[data-action]" ? (inAction ? {} : null) : link) };
    const handled = win.__harnessBridge.onLinkClick({ defaultPrevented: false, preventDefault: () => { prevented = true; } }, target, mode);
    return { handled, prevented };
  };
  assert.deepEqual(handle("screens/orbit.html"), { handled: true, prevented: true });
  assert.deepEqual(sent.at(-1), ["HARNESS_PROTO_GOTO", { target: "screens/orbit.html" }]);
  for (const href of ["#top", "?x=1", "https://x.com", "mailto:a@b.c", "javascript:void(0)", ""]) assert.equal(handle(href).handled, false, href);
  assert.equal(handle("orbit", { mode: "inspect" }).handled, false);
  assert.equal(handle("orbit", { inAction: true }).handled, false);
  assert.equal(sent.length, 1);
});

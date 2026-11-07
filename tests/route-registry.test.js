const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverDir = path.join(__dirname, "..", "ui", "server");
const routesDir = path.join(serverDir, "routes");
const read = (file) => fs.readFileSync(file, "utf8");
const indexSource = read(path.join(routesDir, "index.js"));
const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".routes.js")).sort();

// Route arrays exported by a route file: the names in `module.exports = { ... }` that end in "Routes".
function exportNames(file) {
  const m = read(path.join(routesDir, file)).match(/module\.exports\s*=\s*\{([^}]*)\}/);
  assert.ok(m, `${file} must export its routes array`);
  const names = m[1].split(",").map((n) => n.trim().split(":")[0].trim()).filter((n) => /Routes$/.test(n));
  assert.ok(names.length >= 1, `${file} exports no *Routes array`);
  return names;
}
const count = (text, needle) => text.split(needle).length - 1;

test("every *.routes.js file is required once and spread once in the route index", () => {
  assert.ok(routeFiles.length >= 20, "route files not found");
  for (const file of routeFiles) {
    const base = file.replace(/\.js$/, "");
    assert.equal(count(indexSource, `require("./${base}")`), 1, `${file} must be required once in routes/index.js`);
    for (const name of exportNames(file)) {
      assert.equal(count(indexSource, `...${name},`), 1, `${name} must be spread once in routes/index.js`);
    }
  }
});

test("the index does not spread anything that is not a route file", () => {
  const spread = [...indexSource.matchAll(/^\s*\.\.\.(\w+),$/gm)].map((m) => m[1]);
  const exported = routeFiles.flatMap(exportNames).sort();
  assert.deepEqual([...spread].sort(), exported);
});

test("the router has no inline routes and keeps real headroom under the 300-line cap", () => {
  const router = read(path.join(serverDir, "router.js"));
  assert.ok(!/\{\s*method:\s*"/.test(router), "add routes in ui/server/routes/*.routes.js, not in router.js");
  assert.match(router, /require\("\.\/routes"\)/);
  assert.ok(router.split(/\r?\n/).length <= 150, "router.js should stay small; move logic out of it");
});

test("order constraint: central event routes come before the canonical session routes", () => {
  // .../sessions/stream must win over .../sessions/([^/]+): the first matching route is used.
  const body = indexSource.slice(indexSource.indexOf("const ROUTES = ["));
  assert.ok(body.indexOf("...centralEventRoutes") !== -1 && body.indexOf("...canonicalSessionRoutes") !== -1);
  assert.ok(body.indexOf("...centralEventRoutes") < body.indexOf("...canonicalSessionRoutes"));
});

test("the live table is well formed: valid methods, function handlers, no shadowed duplicates", () => {
  const { ROUTES } = require("../ui/server/router");
  assert.ok(ROUTES.length > 150);
  const seen = new Map();
  for (const route of ROUTES) {
    assert.ok(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(route.method), `bad method ${route.method}`);
    assert.equal(typeof route.handler, "function", `handler of ${route.method} ${route.path}`);
    const key = `${route.method} ${String(route.path)}`;
    assert.ok(!seen.has(key), `duplicate route (the second would never run): ${key}`);
    seen.set(key, true);
  }
});

test("a specific path still wins over a broader regex registered later", () => {
  const { ROUTES } = require("../ui/server/router");
  const firstMatch = (method, p) => ROUTES.find((r) => r.method === method && (typeof r.path === "string" ? r.path === p : r.path.test(p)));
  const stream = firstMatch("GET", "/api/project/demo/sessions/stream");
  const byId = firstMatch("GET", "/api/project/demo/sessions/abc");
  assert.ok(stream && byId, "session routes missing");
  assert.notEqual(stream.handler, byId.handler, "the sessions/stream route must not be taken by sessions/:id");
});

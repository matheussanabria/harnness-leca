const test = require("node:test");
const assert = require("node:assert/strict");
const { apiFeatures, scopeSlug } = require("../ui/server/controllers/features.controller");
const { featuresRoutes } = require("../ui/server/routes/features.routes");

function call(headers) {
  let status = 0;
  let body = "";
  const res = { writeHead: (s) => { status = s; }, setHeader() {}, end: (b) => { body = String(b || ""); } };
  return apiFeatures({ req: { headers }, res }).then(() => ({ status, json: JSON.parse(body) }));
}

test("route is a GET on /api/features", () => {
  assert.deepEqual(featuresRoutes.map((r) => [r.method, r.path]), [["GET", "/api/features"]]);
});

test("scopeSlug accepts valid slugs and rejects junk", () => {
  assert.equal(scopeSlug({ headers: { "x-harness-project": "Meus-Treinos" } }), "meus-treinos");
  assert.equal(scopeSlug({ headers: { "x-harness-project": "../etc" } }), null);
  assert.equal(scopeSlug({ headers: {} }), null);
});

test("without a project, project-scope features are unavailable but chat is", async () => {
  const { status, json } = await call({});
  assert.equal(status, 200);
  assert.equal(json.projeto, null);
  assert.equal(json.funcionalidades.find((f) => f.id === "scrum").disponivel, false);
  assert.equal(json.funcionalidades.find((f) => f.id === "chat").disponivel, true);
});

test("with a project header everything is available", async () => {
  const { json } = await call({ "x-harness-project": "meus-treinos" });
  assert.ok(json.funcionalidades.every((f) => f.disponivel));
});

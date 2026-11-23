const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-features-"));
fs.mkdirSync(path.join(dir, "meus-treinos"));
process.env.HARNESS_PROJECTS_DIR = dir;
const { apiFeatures } = require("../ui/server/controllers/features.controller");
const { featuresRoutes } = require("../ui/server/routes/features.routes");
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

function call(headers) {
  let status = 0;
  let body = "";
  const res = { writeHead: (s) => { status = s; }, setHeader() {}, end: (b) => { body = String(b || ""); } };
  return apiFeatures({ req: { headers }, res }).then(() => ({ status, json: JSON.parse(body) }));
}

test("route is a GET on /api/features", () => {
  assert.deepEqual(featuresRoutes.map((r) => [r.method, r.path]), [["GET", "/api/features"]]);
});

test("without a project, project-scope features are unavailable but chat is", async () => {
  const { status, json } = await call({});
  assert.equal(status, 200);
  assert.equal(json.projeto, null);
  assert.equal(json.funcionalidades.find((f) => f.id === "scrum").disponivel, false);
  assert.equal(json.funcionalidades.find((f) => f.id === "chat").disponivel, true);
});

test("the personal scope behaves like no project", async () => {
  const { json } = await call({ "x-harness-project": "_pessoal" });
  assert.equal(json.projeto, null);
  assert.equal(json.funcionalidades.find((f) => f.id === "scrum").disponivel, false);
});

test("with a known project everything is available", async () => {
  const { json } = await call({ "x-harness-project": "meus-treinos" });
  assert.equal(json.projeto, "meus-treinos");
  assert.ok(json.funcionalidades.every((f) => f.disponivel));
});

test("an unknown project is a 404, never a silent fallback", async () => {
  const { status } = await call({ "x-harness-project": "../etc" });
  assert.equal(status, 404);
});

// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { handle } = require("../ui/server/router");

const fixture = createProjectFixture();
fixture.activate();
test.after(() => fixture.cleanup());

async function get(url) {
  const req = { method: "GET", url, socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:4321" } };
  let statusCode = 0;
  let body = "";
  const res = { setHeader: () => {}, writeHead: (c) => { statusCode = c; }, end: (d) => { body = d; } };
  // @ts-ignore
  await handle(req, res);
  return { statusCode, json: JSON.parse(body) };
}

test("design-story-files: responde found=false quando o JSON ainda nao foi gerado", async () => {
  const r = await get(`/api/project/${fixture.slug}/design/story-files`);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json.found, false);
});

test("design-story-files: devolve as historias do doc/scrum do repositorio do projeto", async () => {
  const file = path.join(fixture.dir, "doc", "scrum", "_historias-arquivos.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ geradoEm: "2026-11-11T00:00:00Z", repos: ["api"], semChave: 1, historias: { "DIS-443": { titulos: ["T"], commits: 2, repos: { api: [{ path: "a/B.java", commits: 2 }] } } } }));
  const r = await get(`/api/project/${fixture.slug}/design/story-files`);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json.found, true);
  assert.equal(r.json.historias["DIS-443"].repos.api[0].path, "a/B.java");
});

test("design-story-files: projeto inexistente responde 404", async () => {
  const r = await get("/api/project/nao-existe/design/story-files");
  assert.equal(r.statusCode, 404);
});

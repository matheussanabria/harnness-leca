// @ts-check
// HTTP routes of the documentation reader (/api/project/:slug/docs/*), read only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { handle } = require("../ui/server/router");

const fixture = createProjectFixture();
fixture.activate();
test.after(() => fixture.cleanup());

async function get(url, method = "GET") {
  const req = { method, url, socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:4321" } };
  let statusCode = 0;
  let body = "";
  const res = { setHeader: () => {}, writeHead: (c) => { statusCode = c; }, end: (d) => { body = d; } };
  // @ts-ignore
  await handle(req, res);
  return { statusCode, json: body ? JSON.parse(body) : null };
}

function write(rel, text) {
  const file = path.join(fixture.dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const base = () => `/api/project/${fixture.slug}/docs`;

test("docs: tree, catalog, refs and one file from the project's doc/", async () => {
  write("doc/sistema/features/calculo/_status.md", "---\r\nhistorias:\r\n  - DIS-443 principal\r\n---\r\n");
  write("doc/sistema/features/calculo/regras.md", "| RN-calculo-001 | regra | |\r\n");
  write("doc/scrum/DIS-443/user-story.md", "# DIS-443 Integração\n");
  const tree = await get(`${base()}/tree`);
  assert.equal(tree.json.found, true);
  const names = tree.json.tree.map((n) => n.name);
  assert.ok(names.includes("scrum") && names.includes("sistema"), names.join(","));
  const catalog = await get(`${base()}/catalog`);
  assert.deepEqual(catalog.json.historias.map((s) => s.id), ["DIS-443"]);
  const refs = await get(`${base()}/refs`);
  assert.equal(refs.json.rn["RN-calculo-001"].anchor, "rn-calculo-001");
  assert.ok(Array.isArray(refs.json.missing));
  const file = await get(`${base()}/file?path=${encodeURIComponent("scrum/DIS-443/user-story.md")}`);
  assert.equal(file.statusCode, 200);
  assert.deepEqual([file.json.path, file.json.ext, file.json.text], ["scrum/DIS-443/user-story.md", "md", "# DIS-443 Integração\n"]);
});

test("docs/file: traversal, missing path and disallowed types are refused", async () => {
  write("doc/a.md", "# A");
  write("fora.md", "# fora");
  const status = async (q) => (await get(`${base()}/file${q}`)).statusCode;
  assert.equal(await status(""), 400);
  assert.equal(await status(`?path=${encodeURIComponent("../fora.md")}`), 400);
  assert.equal(await status(`?path=${encodeURIComponent("%2e%2e/fora.md")}`), 400);
  assert.equal(await status("?path=x.png"), 403);
  assert.equal(await status("?path=nao-existe.md"), 404);
});

test("docs: unknown project answers 404 and writes are not routed", async () => {
  assert.equal((await get("/api/project/nao-existe/docs/tree")).statusCode, 404);
  assert.equal((await get(`${base()}/file?path=a.md`, "POST")).statusCode, 405);
});

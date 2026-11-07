const test = require("node:test");
const assert = require("node:assert/strict");
const { apiCatalogTree, apiCatalogFile, apiCatalogAreaSet, apiCatalogFileSave } = require("../ui/server/controllers/catalog.controller");

// Remote requests only reach the controllers after the router PIN gate, so the read endpoints must not add
// a loopback check; writes stay local-only.
function fakeRes() {
  const res = { code: 0, body: "", headersSent: false, writableEnded: false };
  res.writeHead = (code) => { res.code = code; };
  res.end = (body) => { res.body = body; res.writableEnded = true; };
  return res;
}
const remoteReq = () => ({ socket: { remoteAddress: "192.168.0.20" }, headers: { host: "192.168.0.10:4321" } });
const url = (q) => new URL(`http://x/api/catalog/tree?${q}`);

test("remote request can browse: unknown item is 404, not 403", async () => {
  const q = "kind=skill&source=user&ref=__no_such_skill__";
  const tree = fakeRes();
  await apiCatalogTree({ req: remoteReq(), res: tree, url: url(q) });
  assert.equal(tree.code, 404);
  const file = fakeRes();
  await apiCatalogFile({ req: remoteReq(), res: file, url: url(`${q}&path=SKILL.md`) });
  assert.equal(file.code, 404);
});

test("remote request cannot change an area", async () => {
  const res = fakeRes();
  await apiCatalogAreaSet({ req: remoteReq(), res });
  assert.equal(res.code, 403);
});

test("path traversal from a remote request is still refused", async () => {
  const res = fakeRes();
  await apiCatalogFile({ req: remoteReq(), res, url: url("kind=skill&source=user&ref=..&path=x") });
  assert.ok([400, 404].includes(res.code), `status ${res.code}`);
});

test("remote request cannot edit a file", async () => {
  const res = fakeRes();
  await apiCatalogFileSave({ req: remoteReq(), res });
  assert.equal(res.code, 403);
});

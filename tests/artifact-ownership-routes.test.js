// EP-25.04: HTTP surface of the ownership operations, driven through the real route table.
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const { createOwnershipFixture } = require("./helpers/artifact-ownership-fixture");
const registry = require("../ui/server/services/artifacts/artifact-registry.service");
const { ROUTES } = require("../ui/server/routes");

async function call(urlPath, body) {
  const route = ROUTES.find((r) => r.method === "POST" && r.path instanceof RegExp && r.path.test(urlPath));
  if (!route) return { status: 404, json: { error: "no route" } };
  const params = route.path.exec(urlPath).slice(1);
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  let status = 0;
  let out = "";
  const res = { writeHead: (s) => { status = s; }, setHeader() {}, end: (b) => { out = String(b || ""); } };
  await route.handler({ req, res, params, url: new URL("http://x" + urlPath) });
  return { status, json: JSON.parse(out) };
}

test("preview, confirmed move, undo and copy work over HTTP and errors map to statuses", async () => {
  const f = createOwnershipFixture();
  registry.setStore(f.repo);
  try {
    const { artifact, id } = f.board("alfa", "mindmap", "Mapa");
    const base = `/api/artifacts/${artifact.id}`;

    const preview = await call(`${base}/preview`, { destino: "beta" });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.canProceed, true);

    const refused = await call(`${base}/reassign`, { destino: "beta" });
    assert.deepEqual([refused.status, refused.json.code], [400, "CONFIRMATION_REQUIRED"]);
    assert.ok(f.exists("alfa", "canvas", `${id}.json`), "an unconfirmed move changes nothing");

    const moved = await call(`${base}/reassign`, { destino: "beta", confirmado: true });
    assert.equal(moved.status, 200);
    assert.ok(f.exists("beta", "canvas", `${id}.json`));

    assert.equal((await call(`${base}/reassign`, { destino: "beta", confirmado: true })).status, 409);
    assert.equal((await call(`${base}/reassign`, { destino: "nao-existe", confirmado: true })).status, 404);

    const undone = await call(`${base}/undo`, { logId: moved.json.logId });
    assert.equal(undone.status, 200);
    assert.ok(f.exists("alfa", "canvas", `${id}.json`));

    const copy = await call(`${base}/copy`, { destino: "beta" });
    assert.equal(copy.status, 201);
    assert.equal(copy.json.derivedFrom, artifact.id);
  } finally {
    registry.setStore(undefined);
    f.cleanup();
  }
});

test("only well-formed artifact ids reach a handler, and a missing registry answers 503", async () => {
  assert.equal((await call("/api/artifacts/nao-e-um-id/preview", {})).status, 404);
  registry.setStore(null);
  try {
    const off = await call("/api/artifacts/art_00000000000000000000000000/preview", { destino: "beta" });
    assert.deepEqual([off.status, off.json.code], [503, "REGISTRY_OFF"]);
  } finally {
    registry.setStore(undefined);
  }
});

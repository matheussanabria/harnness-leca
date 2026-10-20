// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { handle } = require("../ui/server/router");

/**
 * Helper para simular chamada HTTP no router
 */
async function mockRequest(method, url) {
  const req = {
    method,
    url,
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  let body = "";
  const headers = {};
  const res = {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  return {
    status: statusCode,
    json: () => (body ? JSON.parse(body) : null),
    text: () => body,
  };
}

test("design-registry routes: GET /api/project/:slug/design/registry lista componentes", async () => {
  const res = await mockRequest("GET", "/api/project/saude-dispensacao/design/registry");
  assert.equal(res.status, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.components), true);
  assert.ok(body.components.some((c) => c.id === "dis.annotation-list"));

  // GET detalhe do componente
  const resDetail = await mockRequest("GET", "/api/project/saude-dispensacao/design/registry/dis.annotation-list");
  assert.equal(resDetail.status, 200);
  const bodyDetail = resDetail.json();
  assert.equal(bodyDetail.ok, true);
  assert.equal(bodyDetail.component.id, "dis.annotation-list");

  // 404 para inexistente
  const res404 = await mockRequest("GET", "/api/project/saude-dispensacao/design/registry/inexistente");
  assert.equal(res404.status, 404);
});

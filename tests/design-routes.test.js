// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { handle } = require("../ui/server/router");

// PENDENTE (pacote 0 do EP-14): depende de projects/saude-dispensacao (gitignored); migrar para fixture em tests/helpers.
test.skip("design-routes: GET /api/project/:slug/design/index responde 200 com estrutura válida", async () => {
  // Testa a chamada através do handler do router
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/index",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  let body = "";
  const res = {
    setHeader: () => {},
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 200);

  const json = JSON.parse(body);
  assert.equal(json.ok, true);
  assert.equal(json.schema, 1);
  assert.equal(Array.isArray(json.components), true);
  assert.equal(Array.isArray(json.prototypes), true);
  const protoIds = json.prototypes.map((p) => p.id);
  assert.ok(protoIds.includes("dis-fluxo-paciente"));
  assert.ok(protoIds.includes("dis-design-system"));
  assert.equal(json.designSystem.mcpServer, "dis-design-system");
  assert.equal(Array.isArray(json.features), true);

  // Confere se achou os componentes de doc/design-system/
  assert.equal(json.components.length >= 4, true);
  const headerComp = json.components.find((c) => c.id === "header-menu-dropdown");
  assert.ok(headerComp);
  assert.equal(headerComp.checklist.inDesignSystem, true);
  assert.equal(headerComp.checklist.hasBoilerplate, true);
});

test("design-routes: GET /api/project/:slug/design/layers responde 200 para funcionalidade existente", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/layers?feature=visao-geral-paciente",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  let body = "";
  const res = {
    setHeader: () => {},
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 200);

  const json = JSON.parse(body);
  assert.equal(json.found, true);
  assert.equal(json.feature, "visao-geral-paciente");
  assert.equal(json.layers.ui.length > 0, true);
  assert.equal(json.layers.regra.length > 0, true);
});

test("design-routes: GET /api/project/:slug/design/file barra arquivos proibidos ou fora da whitelist", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/file?path=.env",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  let body = "";
  const res = {
    setHeader: () => {},
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 403);
});

test("design-routes: GET /api/project/:slug/design/prototype?id=... redireciona para a base correta", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/prototype?id=dis-design-system",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  const headers = {};
  const res = {
    setHeader: (name, val) => { headers[name] = val; },
    writeHead: (code, hdrs) => { statusCode = code; Object.assign(headers, hdrs); },
    end: () => {},
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 302);
  assert.equal(headers["Location"], "/api/project/saude-dispensacao/design/prototype/dis-design-system/");
});

// PENDENTE (pacote 0 do EP-14): depende de projects/saude-dispensacao (gitignored); migrar para fixture em tests/helpers.
test.skip("design-routes: GET /api/project/:slug/design/prototype/:id/ retorna HTML com CSP sandbox", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/prototype/dis-design-system/",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  const headers = {};
  let body = "";
  const res = {
    setHeader: (name, val) => { headers[name] = val; },
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 200);
  assert.equal(headers["Content-Security-Policy"], "sandbox allow-scripts");
  assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(body.length > 1000, true);
});

// PENDENTE (pacote 0 do EP-14): depende de projects/saude-dispensacao (gitignored); migrar para fixture em tests/helpers.
test.skip("design-routes: GET /api/project/:slug/design/prototype/:id/support.js serve asset relativo do prototipo", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-dispensacao/design/prototype/dis-fluxo-paciente/support.js",
    headers: { host: "localhost:4321" },
  };

  let statusCode = 0;
  const headers = {};
  let body = "";
  const res = {
    setHeader: (name, val) => { headers[name] = val; },
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 200);
  assert.equal(headers["Content-Security-Policy"], "sandbox allow-scripts");
  assert.equal(headers["Content-Type"], "application/javascript; charset=utf-8");
  assert.equal(body.length > 1000, true);
});

test("design-routes: protótipo de um projeto não vaza para outro projeto", async () => {
  const req = {
    method: "GET",
    url: "/api/project/saude-prontuario/design/prototype/dis-design-system/",
    headers: { host: "localhost:4321" },
  };
  let statusCode = 0;
  const res = {
    setHeader: () => {},
    writeHead: (code) => { statusCode = code; },
    end: () => {},
  };

  // @ts-ignore
  await handle(req, res);
  assert.equal(statusCode, 404);
});

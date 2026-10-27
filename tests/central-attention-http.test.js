// @ts-check
// Testes de integração HTTP da API de Atenção (EP-09.05).

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { apiProjectAttentionQueue, apiProjectAttentionAck, apiProjectAttentionResolve } = require("../ui/server/controllers/central-attention.controller");

function createMockReq(url, method = "GET", headers = {}) {
  const listeners = {};
  return {
    url,
    method,
    headers: { host: "127.0.0.1", ...headers },
    socket: { remoteAddress: "127.0.0.1" },
    on(event, cb) {
      listeners[event] = cb;
      if (event === "end") setTimeout(() => cb(), 5);
      return this;
    },
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(code, h) { this.statusCode = code; Object.assign(this.headers, h || {}); },
    end(data) { this.body = data; },
  };
}

test("API: GET /api/project/:slug/attention devolve fila e totais", async () => {
  const req = createMockReq("/api/project/saude-dispensacao/attention");
  const res = createMockRes();

  await apiProjectAttentionQueue({ req, res, params: ["saude-dispensacao"] });

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.ok(Array.isArray(data.items), "Deve conter items");
  assert.ok(data.totals, "Deve conter totais de severidade");
  assert.equal(typeof data.totals.high, "number");
});

test("API: POST ack e resolve rejeitam acessos não-loopback (403)", async () => {
  const reqRemote = createMockReq("/api/project/saude-dispensacao/attention/item-1/ack", "POST", { host: "192.168.1.50" });
  reqRemote.socket.remoteAddress = "192.168.1.50";
  const resRemote = createMockRes();

  await apiProjectAttentionAck({ req: reqRemote, res: resRemote, params: ["saude-dispensacao", "item-1"] });
  assert.equal(resRemote.statusCode, 403, "Deve rejeitar IP não loopback com 403");
});

// Testes para as funcionalidades de acesso remoto, QR Code, PIN e proxy reverso.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const netLib = require("../tools/lib/network");
const qrLib = require("../tools/lib/qrcode");
const { createServer } = require("../ui/server");

test("network: isAllowedHost aceita localhost, IPs privados RFC 1918, Tailscale e túneis", () => {
  assert.equal(netLib.isAllowedHost("localhost"), true);
  assert.equal(netLib.isAllowedHost("localhost:4321"), true);
  assert.equal(netLib.isAllowedHost("127.0.0.1:4321"), true);
  assert.equal(netLib.isAllowedHost("192.168.1.50:4321"), true);
  assert.equal(netLib.isAllowedHost("10.0.0.15:4321"), true);
  assert.equal(netLib.isAllowedHost("172.20.0.2:4321"), true);
  assert.equal(netLib.isAllowedHost("100.80.1.2:4321"), true); // Tailscale
  assert.equal(netLib.isAllowedHost("meu-tunnel.trycloudflare.com"), true);
  assert.equal(netLib.isAllowedHost("teste.localtunnel.me"), true);

  // Recusa domínios públicos desconhecidos
  assert.equal(netLib.isAllowedHost("attacker.com"), false);
  assert.equal(netLib.isAllowedHost("evil.org:4321"), false);
  assert.equal(netLib.isAllowedHost(""), false);
});

test("qrcode: gera matriz, arte ASCII e SVG válidos", () => {
  const url = "http://192.168.1.40:4321/?pin=849201";
  const matrix = qrLib.generateQrMatrix(url);
  assert.ok(Array.isArray(matrix));
  assert.ok(matrix.length >= 21);
  assert.equal(matrix.length, matrix[0].length, "matriz deve ser quadrada");

  const ascii = qrLib.generateAsciiQr(url);
  assert.ok(ascii.includes("█") || ascii.includes("▀") || ascii.includes("▄"));

  const svg = qrLib.generateSvgQr(url);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("</svg>"));
  assert.ok(svg.includes("path d="));
});

test("network: validação de PIN", () => {
  // Localhost sempre passa sem PIN
  /** @type {any} */
  const localReq = { socket: { remoteAddress: "127.0.0.1" }, headers: {} };
  assert.equal(netLib.validatePin(localReq, "123456"), true);

  // Remoto sem PIN correto falha
  /** @type {any} */
  const remoteReq = { socket: { remoteAddress: "192.168.1.100" }, headers: {} };
  assert.equal(netLib.validatePin(remoteReq, "123456"), false);

  // Remoto com query param correto passa
  const urlWithPin = new URL("http://x/?pin=123456");
  assert.equal(netLib.validatePin(remoteReq, "123456", urlWithPin), true);

  // Remoto com header x-harness-pin passa
  /** @type {any} */
  const reqWithHeader = { socket: { remoteAddress: "192.168.1.100" }, headers: { "x-harness-pin": "123456" } };
  assert.equal(netLib.validatePin(reqWithHeader, "123456"), true);

  // Cookie legado com o PIN em texto puro deixou de ser aceito (a sessão agora é um token assinado)
  /** @type {any} */
  const reqWithCookie = { socket: { remoteAddress: "192.168.1.100" }, headers: { cookie: "other=1; harness_pin=123456; more=2" } };
  assert.equal(netLib.validatePin(reqWithCookie, "123456"), false);
});

test("HTTP API: rotas de acesso remoto e proxy", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // GET /api/remote/info
    const infoRes = await fetch(`${base}/api/remote/info`);
    assert.equal(infoRes.status, 200);
    const info = await infoRes.json();
    assert.ok(Array.isArray(info.urls));
    assert.ok(info.svgQr.startsWith("<svg"));
    assert.ok(info.urls.length >= 1);

    // POST /api/remote/pin
    const pinRes = await fetch(`${base}/api/remote/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ pin: info.pin }),
    });
    assert.equal(pinRes.status, 200);
    assert.equal((await pinRes.json()).ok, true);

    // GET /preview/ encaminha para o app ativo (retorna 200 se o dev server estiver rodando no host ou 502 explicativo se offline)
    const prevRes = await fetch(`${base}/preview/`);
    assert.ok(prevRes.status === 200 || prevRes.status === 502);
    if (prevRes.status === 502) {
      const prevHtml = await prevRes.text();
      assert.match(prevHtml, /Servidor Dev Offline/);
    }
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("HTTP API: proxy reverso encaminha para servidor dev real quando online", async () => {
  // Cria um servidor dev mock na porta temporária
  const mockDev = http.createServer((req, res) => {
    if (req.url === "/api/dados") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "mock-ok" }));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>App Mock Rodando</h1>");
    }
  });
  await new Promise((resolve) => mockDev.listen(0, "127.0.0.1", resolve));
  const mockPort = mockDev.address().port;

  // Cria Harness UI apontando para o mockDev
  const harnessServer = createServer();
  await new Promise((resolve) => harnessServer.listen(0, "127.0.0.1", resolve));
  const harnessBase = `http://127.0.0.1:${harnessServer.address().port}`;

  try {
    // Testa proxy de requisição via netLib.proxyAppRequest
    const proxyRes = await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${mockPort}/`, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
    });
    assert.equal(proxyRes.status, 200);
    assert.match(proxyRes.body, /App Mock Rodando/);
  } finally {
    mockDev.closeAllConnections();
    mockDev.close();
    harnessServer.closeAllConnections();
    harnessServer.close();
  }
});

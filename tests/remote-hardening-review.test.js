// Correções da revisão de segurança do acesso remoto: Origin no WebSocket, redirecionamento sem "//", rota que ainda
// conferia o socket, e o que o proxy do app de desenvolvimento deixa de repassar.
process.env.HARNESS_PIN = "654321"; // config.js lê o ambiente ao ser carregado; cada arquivo de teste roda em seu processo
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const { createServer } = require("../ui/server");
const { withoutHarnessAuth } = require("../tools/lib/network-proxy");

const PIN = "654321";
const TUNNEL_HOST = "abcd.trycloudflare.com";
let n = 0;
const uniqueIp = () => `192.0.2.${++n}`; // o limitador padrão é compartilhado: um IP por teste evita vazamento

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fn(server.address().port);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function request(port, { method = "GET", path = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const h = { ...headers };
    if (data !== undefined) { h["content-type"] = "application/json"; h["content-length"] = Buffer.byteLength(data); }
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: h }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

const tunnel = (ip, extra = {}) => ({ host: TUNNEL_HOST, "cf-connecting-ip": ip, "x-forwarded-for": ip, ...extra });

/** Faz o login pelo túnel e devolve o cookie de sessão. */
async function login(port, ip) {
  const res = await request(port, {
    method: "POST",
    path: "/api/remote/pin",
    headers: tunnel(ip, { origin: `http://${TUNNEL_HOST}` }),
    body: { pin: PIN },
  });
  assert.equal(res.status, 200);
  return String([].concat(res.headers["set-cookie"]).find((c) => c.startsWith("harness_session="))).split(";")[0];
}

/** Envia um upgrade cru e devolve o que o servidor respondeu até fechar o socket. */
function upgrade(port, headers) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      const lines = ["GET /ws HTTP/1.1", ...Object.entries({ Upgrade: "websocket", Connection: "Upgrade", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", ...headers }).map(([k, v]) => `${k}: ${v}`), "", ""];
      socket.write(lines.join("\r\n"));
    });
    let received = "";
    socket.on("data", (c) => (received += c));
    socket.on("close", () => resolve(received));
    socket.on("error", () => resolve(received));
    setTimeout(() => { socket.destroy(); resolve(received); }, 2000);
  });
}

test("WebSocket: sessão válida com Origin de outro site é recusada (cross-site WebSocket hijacking)", async () => {
  await withServer(async (port) => {
    const ip = uniqueIp();
    const cookie = await login(port, ip);
    const evil = await upgrade(port, { ...tunnel(ip), Cookie: cookie, Origin: "https://evil.example" });
    assert.match(evil, /^HTTP\/1\.1 401/);
    const sameOrigin = await upgrade(port, { ...tunnel(ip), Cookie: cookie, Origin: `http://${TUNNEL_HOST}` });
    assert.doesNotMatch(sameOrigin, /^HTTP\/1\.1 401/, "Origin igual ao Host passa pela autorização (o app de destino pode estar offline)");
  });
});

test("redirecionamento do ?pin= não vira link para outro site", async () => {
  await withServer(async (port) => {
    // new URL("//a//evil.example/x", base) devolve host "a" e pathname "//evil.example/x": sem a correção o Location sairia como "//evil.example/x"
    const res = await request(port, { path: `//a//evil.example/x?pin=${PIN}`, headers: tunnel(uniqueIp()) });
    assert.equal(res.status, 302);
    assert.doesNotMatch(String(res.headers.location), /^\/\//);
    assert.match(String(res.headers.location), /^\/evil\.example\/x$/);
    assert.doesNotMatch(String(res.headers.location), /pin=/);
  });
});

test("/api/engines/activity: sessão remota válida continua barrada (restrita ao host local)", async () => {
  await withServer(async (port) => {
    const ip = uniqueIp();
    const cookie = await login(port, ip);
    const res = await request(port, { path: "/api/engines/activity", headers: tunnel(ip, { cookie }) });
    assert.equal(res.status, 403);
  });
});

test("proxy do app: remove a credencial do Harness e mantém os cookies do app", () => {
  const headers = withoutHarnessAuth({ cookie: `a=1; harness_session=tok; b=2; harness_pin=123456`, "x-harness-pin": PIN, accept: "*/*" });
  assert.equal(headers.cookie, "a=1; b=2");
  assert.equal(headers["x-harness-pin"], undefined);
  assert.equal(headers.accept, "*/*");
  assert.equal(withoutHarnessAuth({ cookie: "harness_session=tok" }).cookie, undefined);
  assert.deepEqual(withoutHarnessAuth({ accept: "x" }), { accept: "x" });
});

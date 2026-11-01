// Endurecimento do acesso remoto (HTTP): o servidor real em 127.0.0.1 recebendo requisições que imitam o túnel da Cloudflare.
process.env.HARNESS_PIN = "654321"; // config.js lê o ambiente ao ser carregado; cada arquivo de teste roda em seu processo
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const { createServer } = require("../ui/server");

const PIN = "654321";
const TUNNEL_HOST = "abcd.trycloudflare.com";
let n = 0;
const uniqueIp = () => `198.51.100.${++n}`; // o limitador padrão é compartilhado: um IP por teste evita vazamento

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    await fn(port);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

/** Requisição crua para poder escolher Host e cabeçalhos de proxy. */
function request(port, { method = "GET", path = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const h = { ...headers };
    if (data !== undefined) { h["content-type"] = "application/json"; h["content-length"] = Buffer.byteLength(data); }
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: h }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on("error", reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

const tunnel = (ip = uniqueIp(), extra = {}) => ({ host: TUNNEL_HOST, "cf-connecting-ip": ip, "x-forwarded-for": ip, ...extra });
const tunnelPost = (ip, extra = {}) => tunnel(ip, { origin: `http://${TUNNEL_HOST}`, ...extra });
const sessionCookie = (res) => String([].concat(res.headers["set-cookie"] || []).find((c) => c.startsWith("harness_session=")) || "").split(";")[0];

test("HTTP: acesso direto local recebe PIN e QR; o mesmo pedido por túnel é barrado no portão", async () => {
  await withServer(async (port) => {
    const direct = await request(port, { path: "/api/remote/info" });
    assert.equal(direct.status, 200);
    assert.equal(direct.json.pin, PIN);
    assert.ok(direct.json.svgQr.startsWith("<svg"));

    const proxied = await request(port, { path: "/api/remote/info", headers: tunnel() });
    assert.equal(proxied.status, 401);
    assert.equal(proxied.json.authRequired, true);
    assert.ok(!proxied.text.includes(PIN));
  });
});

test("HTTP: túnel com PIN válido entra, mas /api/remote/info não devolve PIN nem QR", async () => {
  await withServer(async (port) => {
    const r = await request(port, { path: "/api/remote/info", headers: tunnel(uniqueIp(), { "x-harness-pin": PIN }) });
    assert.equal(r.status, 200);
    assert.equal(r.json.pin, null);
    assert.equal(r.json.svgQr, null);
    assert.deepEqual(r.json.urls, []);
    assert.ok(!r.text.includes(PIN));
  });
});

test("HTTP: GET /?pin= por túnel vira cookie de sessão HttpOnly e redireciona sem o PIN na URL", async () => {
  await withServer(async (port) => {
    const ip = uniqueIp();
    const r = await request(port, { path: "/?pin=" + PIN + "&x=1", headers: tunnel(ip) });
    assert.equal(r.status, 302);
    assert.ok(!/pin=/.test(r.headers.location), r.headers.location);
    assert.equal(r.headers.location, "/?x=1");
    const setCookie = [].concat(r.headers["set-cookie"]).join("\n");
    assert.match(setCookie, /harness_session=/);
    assert.match(setCookie, /HttpOnly/);
    assert.ok(!setCookie.includes(PIN));

    const cookie = sessionCookie(r);
    const next = await request(port, { path: "/api/remote/info", headers: tunnel(ip, { cookie }) });
    assert.equal(next.status, 200);
    assert.equal(next.json.pin, null);
  });
});

test("HTTP: POST /api/remote/pin errado dá 401, o 5o erro bloqueia (429) e nem o PIN certo passa; IP novo entra", async () => {
  await withServer(async (port) => {
    const ip = uniqueIp();
    const post = (pin, addr = ip) => request(port, { method: "POST", path: "/api/remote/pin", headers: tunnelPost(addr), body: { pin } });
    for (let i = 0; i < 4; i++) assert.equal((await post("000000")).status, 401);
    const fifth = await post("000000");
    assert.equal(fifth.status, 429);
    assert.ok(Number(fifth.headers["retry-after"]) > 0);
    const right = await post(PIN);
    assert.equal(right.status, 429, "PIN certo durante o bloqueio");
    assert.ok(!sessionCookie(right));

    const fresh = await post(PIN, uniqueIp());
    assert.equal(fresh.status, 200);
    assert.match(sessionCookie(fresh), /^harness_session=.+/);
  });
});

test("HTTP: rotas só-locais recusam túnel e aceitam o computador direto", async () => {
  await withServer(async (port) => {
    const body = { chatId: "c1", tool: "Read", input: {} };
    const noPin = await request(port, { method: "POST", path: "/api/permissions/request", headers: tunnelPost(uniqueIp()), body });
    assert.ok([401, 403].includes(noPin.status), String(noPin.status));
    // Com PIN o portão libera, mas o controller continua recusando por não ser loopback direto
    const withPin = await request(port, { method: "POST", path: "/api/permissions/request", headers: tunnelPost(uniqueIp(), { "x-harness-pin": PIN }), body });
    assert.equal(withPin.status, 403);

    // Direto: corpo incompleto cai na validação (400), ou seja, passou pelo portão e pelo "só local"
    const direct = await request(port, {
      method: "POST", path: "/api/permissions/request", body: {},
      headers: { origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}` },
    });
    assert.equal(direct.status, 400);
  });
});

test("HTTP: upgrade WebSocket sem PIN por túnel recebe 401 e a conexão fecha", async () => {
  await withServer(async (port) => {
    const raw = await new Promise((resolve, reject) => {
      const sock = net.connect(port, "127.0.0.1");
      let data = "";
      sock.setTimeout(3000, () => { sock.destroy(); reject(new Error("timeout")); });
      sock.on("data", (c) => (data += c));
      sock.on("close", () => resolve(data));
      sock.on("error", reject);
      sock.write([
        "GET /x HTTP/1.1", `Host: ${TUNNEL_HOST}`, `CF-Connecting-IP: ${uniqueIp()}`,
        "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Version: 13", "", "",
      ].join("\r\n"));
    });
    assert.ok(raw.startsWith("HTTP/1.1 401"), raw.slice(0, 40));
  });
});

test("HTTP: página de login para túnel sem sessão trata #pin= e não contém o PIN configurado", async () => {
  await withServer(async (port) => {
    const r = await request(port, { path: "/", headers: tunnel() });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /text\/html/);
    assert.match(r.text, /pin=\(\[\^&\]\+\)/);
    assert.match(r.text, /window\.location\.hash/);
    assert.ok(!r.text.includes(PIN));
  });
});

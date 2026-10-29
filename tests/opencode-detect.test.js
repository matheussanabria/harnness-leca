// Detecção do servidor do OpenCode: servidores HTTP falsos em porta 0 e lista de processos/portas injetada
// (nenhum comando real do sistema roda, nenhum OpenCode de verdade é tocado).
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const D = require("../tools/lib/opencode-detect");
const P = require("../tools/lib/opencode-ports");
const { PublicError } = require("../tools/lib/engines/common");

const listen = (handler) => new Promise((resolve) => {
  const seen = [];
  const server = http.createServer((req, res) => { seen.push(req.headers); handler(req, res); });
  server.listen(0, "127.0.0.1", () => resolve({ server, seen, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` }));
});
const json = (req, res) => { res.setHeader("content-type", "application/json"); res.end("[]"); };
const html = (req, res) => { res.setHeader("content-type", "text/html"); res.end("<html>nao sou o opencode</html>"); };
const close = (...s) => Promise.all(s.map((x) => new Promise((r) => { x.server.closeAllConnections?.(); x.server.close(r); })));
const freePort = async () => { const s = await listen(json); const p = s.port; await close(s); return p; };
const fakeSys = (ports, platform = "win32") => ({
  platform,
  run: async (cmd) => {
    if (cmd === "tasklist") return '"opencode.exe","4242","Console","1","50,000 K"\n"node.exe","7","Console","1","1 K"\n';
    if (cmd === "powershell") return "";
    if (cmd === "netstat") return ports.map((p) => `  TCP    127.0.0.1:${p}    0.0.0.0:0    LISTENING    4242`).join("\n") + "\n  TCP    0.0.0.0:9999   0.0.0.0:0   LISTENING   1\n";
    throw new Error("comando inesperado " + cmd);
  },
});
test.beforeEach(() => D.invalidateOpenCodeUrl());

test("discoverPorts: casa o nome da imagem sem diferenciar maiúsculas, usa só os PIDs certos e acha hospedeiros por linha de comando", async () => {
  const sys = {
    platform: "win32",
    run: async (cmd) => ({
      tasklist: '"OpenCode.EXE","10","Console","1","1 K"\n"node.exe","20","Console","1","1 K"\n',
      powershell: "20\r\n",
      netstat: "  TCP 0.0.0.0:5001 0.0.0.0:0 LISTENING 10\n  TCP [::]:5002 [::]:0 LISTENING 20\n  TCP 0.0.0.0:5003 0.0.0.0:0 LISTENING 30\n  TCP 1.1.1.1:5004 2.2.2.2:80 ESTABLISHED 10\n",
    }[cmd]),
  };
  const r = await P.discoverPorts(sys);
  assert.deepEqual(r.ports.sort(), [5001, 5002]);
  assert.deepEqual(r.errors, []);
});

test("discoverPorts: falha de comando vira erro registrado, não exceção silenciosa", async () => {
  const r = await P.discoverPorts({ platform: "linux", run: async () => { throw new Error("sem pgrep"); } });
  assert.deepEqual(r.ports, []);
  assert.ok(r.errors.length >= 1 && /sem pgrep/.test(r.errors[0]));
});

test("detecta o servidor válido e ignora outro serviço em porta diferente", async () => {
  const wrong = await listen(html), good = await listen(json);
  try {
    const r = await D.detectOpenCodeUrl({ sys: fakeSys([wrong.port, good.port]), env: {} });
    assert.equal(r.url, good.url);
    assert.equal(r.tried[0].ok, false);
    assert.match(r.tried[0].reason, /JSON/);
    assert.equal(r.tried[1].ok, true);
  } finally { await close(wrong, good); }
});

test("OPENCODE_URL válido vence e não precisa descobrir portas; inválido cai para a porta descoberta", async () => {
  const good = await listen(json), dead = await freePort();
  try {
    const noScan = { platform: "win32", run: async () => { throw new Error("não devia varrer"); } };
    assert.equal((await D.detectOpenCodeUrl({ sys: noScan, env: { OPENCODE_URL: good.url + "/" } })).url, good.url);
    const r = await D.detectOpenCodeUrl({ sys: fakeSys([good.port]), env: { OPENCODE_URL: `http://127.0.0.1:${dead}` } });
    assert.equal(r.url, good.url);
    assert.equal(r.tried[0].ok, false);
  } finally { await close(good); }
});

test("sem servidor nenhum: url nula, tentativas descritas, e resolve lança PublicError com instrução em português", async () => {
  const dead = await freePort();
  const env = { OPENCODE_URL: `http://127.0.0.1:${dead}` };
  // O endereço padrão também é fictício: um opencode de verdade rodando em 63186 não pode mudar o resultado.
  const defaultUrl = `http://127.0.0.1:${await freePort()}`;
  const r = await D.detectOpenCodeUrl({ sys: fakeSys([]), env, defaultUrl });
  assert.equal(r.url, null);
  assert.ok(r.tried.length >= 2 && r.tried.every((t) => !t.ok && t.reason));
  await assert.rejects(D.resolveOpenCodeUrl({ sys: fakeSys([]), env, defaultUrl }), (err) => {
    assert.ok(err instanceof PublicError);
    assert.match(err.message, /não respondeu/);
    assert.match(err.message, /opencode serve/);
    assert.match(err.message, /OPENCODE_URL/);
    assert.ok(err.message.includes(`127.0.0.1:${dead}`));
    return true;
  });
});

test("HTTP 401 gera mensagem própria sobre a senha", async () => {
  const locked = await listen((req, res) => { res.statusCode = 401; res.end("no"); });
  try {
    await assert.rejects(D.resolveOpenCodeUrl({ sys: fakeSys([]), env: { OPENCODE_URL: locked.url } }), (err) => {
      assert.ok(err instanceof PublicError);
      assert.match(err.message, /senha/);
      assert.match(err.message, /OPENCODE_SERVER_PASSWORD/);
      return true;
    });
  } finally { await close(locked); }
});

test("com OPENCODE_SERVER_PASSWORD envia Basic opencode:senha na sondagem e em ocFetch; sem a variável não envia", async () => {
  const srv = await listen((req, res) => {
    if (req.headers.authorization !== "Basic " + Buffer.from("opencode:segredo-de-teste").toString("base64")) { res.statusCode = 401; return res.end(); }
    json(req, res);
  });
  const saved = process.env.OPENCODE_SERVER_PASSWORD;
  try {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    assert.equal((await D.probe(srv.url)).status, 401);
    process.env.OPENCODE_SERVER_PASSWORD = "segredo-de-teste";
    assert.equal((await D.probe(srv.url)).ok, true);
    assert.equal((await D.ocFetch(`${srv.url}/session`)).status, 200);
    assert.equal(srv.seen.at(-1).authorization, "Basic " + Buffer.from("opencode:segredo-de-teste").toString("base64"));
  } finally {
    if (saved === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = saved;
    await close(srv);
  }
});

test("a URL validada fica em cache curto e invalidate força nova validação", async () => {
  const srv = await listen(json);
  try {
    const opts = { sys: fakeSys([]), env: { OPENCODE_URL: srv.url } };
    assert.equal(await D.resolveOpenCodeUrl(opts), srv.url);
    const hits = srv.seen.length;
    assert.equal(await D.resolveOpenCodeUrl(opts), srv.url);
    assert.equal(srv.seen.length, hits);
    D.invalidateOpenCodeUrl();
    await D.resolveOpenCodeUrl(opts);
    assert.equal(srv.seen.length, hits + 1);
  } finally { await close(srv); }
});

// Autostart do 9router/opencode e a mensagem "OpenCode desligado". Sem subir processo real.
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { ensureEngineServices, isUp } = require("../tools/lib/engine-autostart");
const { describeError } = require("../tools/lib/engines/errors");

function listen() {
  return new Promise((resolve) => {
    const srv = http.createServer((_req, res) => { res.statusCode = 404; res.end("x"); });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

test("isUp: qualquer resposta HTTP conta como ligado; porta fechada, não", async () => {
  const srv = await listen();
  const port = srv.address().port;
  assert.equal(await isUp(`http://127.0.0.1:${port}/`), true);
  await new Promise((r) => srv.close(r));
  assert.equal(await isUp(`http://127.0.0.1:${port}/`), false);
});

test("autostart: o que já está no ar não é reiniciado", async () => {
  const srv = await listen();
  const logs = [];
  const res = await ensureEngineServices({
    env: {}, log: (l) => logs.push(l),
    services: [{ name: "fake", probe: `http://127.0.0.1:${srv.address().port}/`, command: "nao-existe-xyz", args: [] }],
  });
  await new Promise((r) => srv.close(r));
  assert.deepEqual(res, { fake: "already-up" });
  assert.equal(logs.length, 0);
});

test("autostart: HARNESS_AUTOSTART=0 e testes de unidade (HARNESS_ROOT) não fazem nada", async () => {
  const services = [{ name: "fake", probe: "http://127.0.0.1:1/", command: "nao-existe-xyz", args: [] }];
  assert.deepEqual(await ensureEngineServices({ env: { HARNESS_AUTOSTART: "0" }, services }), {});
  assert.deepEqual(await ensureEngineServices({ env: { HARNESS_ROOT: "x" }, services }), {});
});

test("autostart: binário inexistente vira 'failed' com instrução manual, sem lançar", async () => {
  const logs = [];
  const res = await ensureEngineServices({
    env: {}, waitMs: 1200, log: (l) => logs.push(l),
    services: [{ name: "fake", probe: "http://127.0.0.1:1/", command: "nao-existe-xyz-harness", args: ["serve"] }],
  });
  assert.equal(res.fake, "failed");
  assert.ok(logs.some((l) => /Rode manualmente: nao-existe-xyz-harness serve/.test(l)));
});

test("senha do opencode: gerada uma vez em global/.env e reaproveitada; a do ambiente vence", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const { ensureOpenCodePassword } = require("../tools/lib/engine-autostart");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-pass-"));
  const file = path.join(dir, "global", ".env");
  const env = {};
  const first = ensureOpenCodePassword(env, file);
  assert.match(first, /^[a-f0-9]{36}$/);
  assert.equal(env.OPENCODE_SERVER_PASSWORD, first);
  assert.equal(fs.readFileSync(file, "utf8"), `OPENCODE_SERVER_PASSWORD=${first}\n`);
  assert.equal(ensureOpenCodePassword({ OPENCODE_SERVER_PASSWORD: "ja-definida" }, file), "ja-definida");
  assert.equal(fs.readFileSync(file, "utf8").match(/OPENCODE_SERVER_PASSWORD/g).length, 1, "não grava de novo");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("fetch failed no opencode vira 'OpenCode desligado' com o comando para ligar", () => {
  const info = describeError(new Error("fetch failed"), { engine: "opencode" });
  assert.equal(info.code, "server_down");
  assert.equal(info.title, "OpenCode desligado");
  assert.match(info.hint, /npm run opencode/);
  assert.match(info.hint, /9router/);
  assert.equal(info.retryable, true);
  // outros motores não ganham essa mensagem
  assert.notEqual(describeError(new Error("fetch failed"), { engine: "gemini" }).code, "server_down");
});

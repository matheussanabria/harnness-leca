// Upload de anexos do chat (arquivos, imagens, áudio): POST /api/chat/upload.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-upl-"));
process.env.HARNESS_ROOT = TMP_ROOT;
fs.mkdirSync(path.join(TMP_ROOT, "projects", "demo"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { createServer } = require("../ui/server");
let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.closeAllConnections(); server.close(); });

const up = (query, body, headers = {}) => fetch(`${base}/api/chat/upload?${query}`, {
  method: "POST", headers: { "Content-Type": "application/octet-stream", Origin: base, ...headers }, body,
});

test("upload grava o arquivo em context/uploads e devolve o caminho", async () => {
  const res = await up("slug=demo&name=print%20mobile.png", Buffer.from([137, 80, 78, 71]));
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.kind, "image");
  assert.ok(j.path.startsWith(path.join(TMP_ROOT, "projects", "demo", "context", "uploads")));
  assert.deepEqual([...fs.readFileSync(j.path)], [137, 80, 78, 71]);
});

test("upload de áudio é classificado como audio", async () => {
  const j = await (await up("slug=demo&name=audio-1.webm", Buffer.from("abc"))).json();
  assert.equal(j.kind, "audio");
});

test("upload recusa extensão perigosa, projeto inexistente, corpo vazio e travessia de caminho", async () => {
  assert.equal((await up("slug=demo&name=x.exe", Buffer.from("a"))).status, 415);
  assert.equal((await up("slug=nope&name=a.png", Buffer.from("a"))).status, 404);
  assert.equal((await up("slug=demo&name=a.png", Buffer.alloc(0))).status, 400);
  const j = await (await up("slug=demo&name=..%2F..%2Fevil.png", Buffer.from("a"))).json();
  assert.ok(j.path.startsWith(path.join(TMP_ROOT, "projects", "demo", "context", "uploads")));
});

test("upload bloqueia origem externa e content-type que não seja octet-stream", async () => {
  assert.equal((await up("slug=demo&name=a.png", Buffer.from("a"), { Origin: "http://evil.com" })).status, 403);
  assert.equal((await up("slug=demo&name=a.png", Buffer.from("a"), { "Content-Type": "text/plain" })).status, 403);
});

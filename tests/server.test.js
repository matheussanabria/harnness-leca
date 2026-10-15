// Rotas do ui/server.js, com o servidor em memória (porta livre) e uma raiz do harness temporária.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-srv-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const proj = path.join(TMP_ROOT, "projects", "demo");
fs.mkdirSync(path.join(proj, "chats"), { recursive: true });
fs.mkdirSync(path.join(proj, "context"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });
fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "DEMO\n");
fs.writeFileSync(path.join(proj, "instructions.md"), "# regras\n- seja breve\n");
fs.writeFileSync(path.join(proj, "memory.md"), "- fato\n");
fs.writeFileSync(path.join(proj, "chats", "2026-01-01-a-aaaaaaaa.md"), '---\ntitulo: "A"\nsessao: aaaaaaaa\nagente: "claude"\ninicio: 2026-01-01T00:00:00Z\nfim: 2026-01-01T00:00:00Z\n---\n# A\n\n## Você\n\noi\n');
fs.writeFileSync(path.join(proj, "context", "ref.md"), "contexto\n");
fs.writeFileSync(path.join(proj, "extraction-state.json"), "{}"); // existe, mas /api/file não pode servir
fs.writeFileSync(path.join(TMP_ROOT, "global", "instructions.md"), "global");
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const E = require("../tools/lib/engines");
const { createServer } = require("../ui/server");

let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.closeAllConnections(); server.close(); });

const get = (p, init) => fetch(base + p, init);
const post = (p, body, extra = {}) => fetch(base + p, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...extra }, body: JSON.stringify(body),
});
const until = async (cond, ms = 3000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 20)); return cond(); };

test("GET /api/state e /api/project: dados do projeto, projeto ativo ignora maiúsculas", async () => {
  const state = await (await get("/api/state")).json();
  assert.equal(state.active, "demo");
  assert.deepEqual(state.projects, ["demo"], "_template não aparece");
  assert.equal(state.global.instructions, "global");

  const p = await (await get("/api/project/demo")).json();
  assert.equal(p.slug, "demo");
  assert.match(p.instructions, /seja breve/);
  assert.equal(p.chats.length, 1);
  assert.equal(p.chats[0].agent, "claude");
  assert.equal(p.chats[0].status, "nova");
  assert.equal(p.extraction.total, 1);

  const missing = await get("/api/project/nao-existe");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "projeto não encontrado");
});

test("GET /api/file: só arquivos permitidos do projeto, sem sair de projects/", async () => {
  const file = (rel) => get(`/api/file?path=${encodeURIComponent(rel)}`);
  assert.equal((await (await file("demo/memory.md")).json()).content, "- fato\n");
  assert.match((await (await file("demo/chats/2026-01-01-a-aaaaaaaa.md")).json()).content, /## Você/);
  assert.equal((await file("demo/context/ref.md")).status, 200);

  for (const bad of ["demo/extraction-state.json", "demo/../../global/instructions.md", "../global/instructions.md",
    "demo/chats/../memory.md", "demo/chats/", "demo/nada.md", "", "C:/Windows/win.ini", "demo/chats/%2e%2e"]) {
    assert.equal((await file(bad)).status, 404, `devia negar: ${bad}`);
  }
});

test("arquivos estáticos: index.html sim; fora de ui/public, tipo desconhecido e caminho com .. não", async () => {
  const home = await get("/");
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /<html/i);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.match(home.headers.get("content-security-policy"), /default-src 'none'/);
  for (const bad of ["/nada.html", "/../server.js", "/..%2fserver.js", "/%2e%2e/%2e%2e/package.json", "/server.js"]) {
    assert.equal((await get(bad)).status, 404, `devia negar: ${bad}`);
  }
  assert.equal((await get("/%00")).status, 400);
});

test("método errado em rota conhecida é 405; HEAD usa a rota do GET", async () => {
  assert.equal((await get("/api/chat")).status, 405);
  assert.equal((await post("/api/state", {})).status, 405);
  assert.equal((await fetch(base + "/api/state", { method: "HEAD" })).status, 200);
  assert.equal((await fetch(base + "/api/state", { method: "DELETE" })).status, 405);
});

test("POST /api/chat/save: valida, grava no projeto e não vaza erro interno", async () => {
  assert.equal((await post("/api/chat/save", { slug: "demo" })).status, 400);
  assert.equal((await post("/api/chat/save", { slug: "nao-existe", turns: [] })).status, 404);

  const ok = await post("/api/chat/save", { slug: "demo", engine: "gemini", title: "Salva pela UI", sessionId: "55555555-aaaa-4aaa-8aaa-000000000005", turns: [{ role: "user", text: "oi" }, { role: "assistant", text: "olá", engine: "gemini" }] });
  assert.equal(ok.status, 200);
  const saved = await ok.json();
  assert.equal(saved.ok, true);
  assert.match(fs.readFileSync(path.join(proj, "chats", saved.fileName), "utf8"), /^## Gemini$/m);

  const bad = await post("/api/chat/save", { slug: "demo", turns: [null] }); // quebra dentro de saveChatToProject
  assert.equal(bad.status, 500);
  assert.match((await bad.json()).error, /detalhe está no terminal/);
});

test("POST /api/chat: no máximo 2 respostas ao mesmo tempo, e fechar a conexão cancela o motor", async (t) => {
  const signals = [];
  E.engines.set("fake", { id: "fake", status: async () => ({}), stream: ({ signal, onChunk }) => { signals.push(signal); onChunk({ type: "text", text: "oi" }); } });
  t.after(() => E.engines.delete("fake"));

  const hang = async () => {
    const ac = new AbortController();
    const res = await fetch(base + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base }, signal: ac.signal,
      body: JSON.stringify({ engine: "fake", prompt: "oi", slug: "demo" }),
    });
    const reader = res.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /"type":"text"/);
    return ac;
  };

  const a = await hang();
  const b = await hang();
  const third = await post("/api/chat", { engine: "fake", prompt: "oi", slug: "demo" });
  assert.equal(third.status, 429);
  assert.equal(signals.length, 2);

  a.abort();
  assert.ok(await until(() => signals[0].aborted), "o motor recebe o cancelamento quando o cliente sai");
  assert.equal(signals[1].aborted, false, "a outra conversa segue");

  const c = await hang(); // a vaga foi liberada
  b.abort(); c.abort();
  assert.ok(await until(() => signals.every((s) => s.aborted)));
});

test("POST /api/chat: validações e motor desconhecido (inclusive __proto__)", async () => {
  assert.equal((await post("/api/chat", { engine: "claude", slug: "demo" })).status, 400);
  assert.equal((await post("/api/chat", { engine: "claude", prompt: "oi", slug: "nao-existe" })).status, 404);
  for (const engine of ["nao-existe", "__proto__", "constructor", undefined]) {
    const res = await post("/api/chat", { engine, prompt: "oi", slug: "demo" });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /não suportado/);
  }
});

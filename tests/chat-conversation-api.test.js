// EP-17.02: conversations API over a real server and a temp database: save mirrors into the database, the server
// resolves the engine session, history pages by seq, PATCH renames and archives, the rollback flag turns it off.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-conv-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.HARNESS_DB_PATH = path.join(TMP_ROOT, "data", "harness.sqlite");
delete process.env.HARNESS_CHAT_STORE;
fs.mkdirSync(path.join(TMP_ROOT, "projects", "demo"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });

const { createServer } = require("../ui/server");
const svc = require("../ui/server/services/chat/conversation.service");
let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.closeAllConnections();
  server.close();
  svc.setStore(undefined);
  require("../ui/server/db/connection").closeDb();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: { "Content-Type": "application/json", Origin: base }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const turns = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? { role: "assistant", engine: "opencode", text: `resposta ${i}`, thinking: "pensei" } : { role: "user", text: `pergunta ${i}` }));

test("save mirrors the chat; saving again appends only new turns; the session is resolved by the server", async () => {
  const first = await call("POST", "/api/chat/save", { slug: "demo", engine: "opencode", title: "PRD", turns: turns(2), sessionId: "ses_e6811a9c" });
  assert.equal(first.status, 200);
  assert.match(first.body.conversationId, /^[0-9a-f-]{36}$/);
  const again = await call("POST", "/api/chat/save", { slug: "demo", engine: "opencode", title: "PRD", turns: turns(4), sessionId: "ses_e6811a9c" });
  assert.equal(again.body.fileName, first.body.fileName);
  assert.equal(again.body.conversationId, first.body.conversationId);

  const byFile = await call("GET", `/api/chat/conversations?project=demo&file=${encodeURIComponent(first.body.fileName)}`);
  assert.equal(byFile.status, 200);
  assert.deepEqual(byFile.body.sessions, { opencode: "ses_e6811a9c" });
  assert.equal(byFile.body.messageCount, 4);

  const page = await call("GET", `/api/chat/conversations/${first.body.conversationId}?after=1&limit=2`);
  assert.deepEqual(page.body.messages.map((m) => [m.seq, m.role, m.content]), [[2, "user", "pergunta 2"], [3, "assistant", "resposta 3"]]);
});

test("a new engine session for a saved chat survives a server restart", async () => {
  const saved = await call("POST", "/api/chat/save", { slug: "demo", engine: "claude", title: "Outro", turns: turns(2), sessionId: "cl_1" });
  const put = await call("POST", "/api/chat/conversations/sessions", { project: "demo", file: saved.body.fileName, engine: "gemini", sessionId: "gem_9" });
  assert.equal(put.status, 200);
  svc.setStore(undefined); // drop the open repository, as a restarted process would
  require("../ui/server/db/connection").closeDb();
  const byFile = await call("GET", `/api/chat/conversations?project=demo&file=${encodeURIComponent(saved.body.fileName)}`);
  assert.deepEqual(byFile.body.sessions, { claude: "cl_1", gemini: "gem_9" });
});

test("create, list newest first, rename and archive", async () => {
  const created = await call("POST", "/api/chat/conversations", { project: "demo", title: "Rascunho" });
  assert.equal(created.status, 201);
  const list = await call("GET", "/api/chat/conversations?project=demo");
  assert.equal(list.body.conversations[0].id, created.body.id);
  const patched = await call("PATCH", `/api/chat/conversations/${created.body.id}`, { title: "Renomeado", archived: true });
  assert.equal(patched.body.title, "Renomeado");
  assert.ok(patched.body.archivedAt);
  const after = await call("GET", "/api/chat/conversations?project=demo");
  assert.ok(!after.body.conversations.some((c) => c.id === created.body.id), "archived is hidden");
});

test("browser session map import fills only unknown engines", async () => {
  const saved = await call("POST", "/api/chat/save", { slug: "demo", engine: "codex", title: "Mapa", turns: turns(2), sessionId: "cx_server" });
  const res = await call("POST", "/api/chat/conversations/import-sessions", { project: "demo", byFile: { [saved.body.fileName]: { codex: "cx_old", ollama: "ol_1", bogus: "x" } } });
  assert.equal(res.body.imported, 1);
  const byFile = await call("GET", `/api/chat/conversations?project=demo&file=${encodeURIComponent(saved.body.fileName)}`);
  assert.deepEqual(byFile.body.sessions, { codex: "cx_server", ollama: "ol_1" });
});

test("bad input: unknown project 404, invalid session 400, unknown id 404", async () => {
  assert.equal((await call("GET", "/api/chat/conversations?project=nope")).status, 404);
  assert.equal((await call("POST", "/api/chat/conversations/sessions", { project: "demo", file: "x.md", engine: "claude", sessionId: "bad id!" })).status, 400);
  assert.equal((await call("GET", "/api/chat/conversations/00000000-0000-0000-0000-000000000000")).status, 404);
});

test("secrets are redacted before they reach the database", async () => {
  const secret = "sk-ant-api03-" + "B".repeat(80);
  const saved = await call("POST", "/api/chat/save", { slug: "demo", engine: "claude", title: "Segredo", turns: [{ role: "user", text: `minha chave ${secret}` }, { role: "assistant", engine: "claude", text: "ok" }], sessionId: "cl_s" });
  const page = await call("GET", `/api/chat/conversations/${saved.body.conversationId}`);
  assert.ok(!JSON.stringify(page.body).includes(secret));
});

test("HARNESS_CHAT_STORE=file: routes answer 503 and save still writes the .md file", async () => {
  process.env.HARNESS_CHAT_STORE = "file";
  try {
    assert.equal((await call("GET", "/api/chat/conversations?project=demo")).status, 503);
    const saved = await call("POST", "/api/chat/save", { slug: "demo", engine: "claude", title: "Sem banco", turns: turns(2), sessionId: "cl_f" });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.conversationId, null);
    assert.ok(fs.existsSync(path.join(TMP_ROOT, "projects", "demo", "chats", saved.body.fileName)));
  } finally {
    delete process.env.HARNESS_CHAT_STORE;
  }
});

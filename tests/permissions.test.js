// @ts-check
// Permissões do Claude Code respondidas pela interface: regras e escopos, a ferramenta MCP, as rotas e os argumentos do CLI.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-perm-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.HARNESS_PERM_TIMEOUT_MS = "300"; // os testes de tempo esgotado não podem esperar 10 minutos
const proj = path.join(TMP_ROOT, "projects", "demo");
fs.mkdirSync(path.join(proj, "chats"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });
fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "demo\n");
const outside = path.join(TMP_ROOT, "fora");
fs.mkdirSync(path.join(outside, "sub"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "outra"), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const perms = require("../tools/lib/permissions");
const { claudeSession } = require("../tools/lib/engines/claude");
const { createServer } = require("../ui/server");

let n = 0;
/** Conversa nova com os eventos capturados. */
function chat(slug = "demo") {
  const id = `chat-${++n}`, events = [];
  perms.attachChat(id, slug, (e) => events.push(e));
  return { id, events, ask: (tool, input) => perms.request({ chatId: id, tool, input }) };
}
const lastPermission = (events) => events.filter((e) => e.type === "permission" && !e.auto).at(-1);
const readFile = (dir, name = "a.txt") => ({ file_path: path.join(dir, name) });

test("pedido sem regra espera a resposta; 'uma vez' libera só aquele pedido", async () => {
  const c = chat();
  const p = c.ask("Read", readFile(outside));
  const ev = lastPermission(c.events);
  assert.ok(ev, "o cartão foi emitido");
  assert.equal(ev.kind, "file");
  assert.equal(ev.access, "read");
  assert.deepEqual(ev.scopes, ["once", "chat", "project"]);
  assert.deepEqual(perms.answer(ev.id, { decision: "allow", scope: "once" }), { ok: true });
  assert.deepEqual(await p, { behavior: "allow" });
  assert.ok(c.events.some((e) => e.type === "permission_resolved" && e.id === ev.id && e.decision === "allow"));

  const again = c.ask("Read", readFile(outside));
  assert.ok(lastPermission(c.events).id !== ev.id, "pergunta de novo");
  perms.answer(lastPermission(c.events).id, { decision: "deny" });
  const d = await again;
  assert.equal(d.behavior, "deny");
  assert.match(d.message || "", /negou/);
  perms.detachChat(c.id);
});

test("escopo 'chat' libera a pasta (inclusive subpastas) só nessa conversa", async () => {
  const c = chat();
  const p = c.ask("Read", readFile(outside));
  perms.answer(lastPermission(c.events).id, { decision: "allow", scope: "chat" });
  await p;
  const before = c.events.length;
  assert.deepEqual(await c.ask("Read", readFile(path.join(outside, "sub"), "b.txt")), { behavior: "allow" }, "subpasta coberta");
  assert.ok(c.events.slice(before).every((e) => e.auto), "sem cartão novo, só aviso automático");

  const other = c.ask("Read", readFile(path.join(TMP_ROOT, "outra")));
  assert.ok(lastPermission(c.events).dir.endsWith("/outra"), "outra pasta continua perguntando");
  perms.answer(lastPermission(c.events).id, { decision: "deny" });
  await other;

  const c2 = chat(); // outra conversa não herda
  const p2 = c2.ask("Read", readFile(outside));
  assert.ok(lastPermission(c2.events));
  perms.answer(lastPermission(c2.events).id, { decision: "deny" });
  await p2;
  perms.detachChat(c.id); perms.detachChat(c2.id);
});

test("escopo 'project' grava em permissions.json, vale em outra conversa e pode ser removido", async () => {
  const c = chat();
  const p = c.ask("Read", readFile(outside));
  perms.answer(lastPermission(c.events).id, { decision: "allow", scope: "project" });
  await p;
  const saved = JSON.parse(fs.readFileSync(path.join(proj, "permissions.json"), "utf8"));
  assert.equal(saved.allow.length, 1);
  assert.equal(saved.allow[0].kind, "dir");
  assert.equal(saved.allow[0].access, "read");

  const c2 = chat();
  assert.deepEqual(await c2.ask("Glob", { path: outside, pattern: "*" }), { behavior: "allow" });
  assert.equal(lastPermission(c2.events), undefined);

  assert.equal(perms.removeRule("demo", 5), false);
  assert.equal(perms.removeRule("demo", 0), true);
  assert.deepEqual(perms.listRules("demo"), []);
  perms.detachChat(c.id); perms.detachChat(c2.id);
});

test("regra de leitura não cobre escrita; escrita cobre leitura", async () => {
  const c = chat();
  const w = c.ask("Edit", readFile(outside));
  assert.equal(lastPermission(c.events).access, "write");
  perms.answer(lastPermission(c.events).id, { decision: "allow", scope: "chat" });
  await w;
  assert.deepEqual(await c.ask("Read", readFile(outside, "z.txt")), { behavior: "allow" });
  perms.detachChat(c.id);

  const r = chat();
  const p = r.ask("Read", readFile(outside));
  perms.answer(lastPermission(r.events).id, { decision: "allow", scope: "chat" });
  await p;
  const w2 = r.ask("Write", readFile(outside, "novo.txt"));
  assert.ok(lastPermission(r.events), "escrever ainda pergunta");
  perms.answer(lastPermission(r.events).id, { decision: "deny" });
  await w2;
  perms.detachChat(r.id);
});

test("caminho sensível só vale uma vez, mesmo se pedirem 'sempre'", async () => {
  const c = chat();
  const p = c.ask("Read", { file_path: path.join(outside, ".env") });
  const ev = lastPermission(c.events);
  assert.equal(ev.sensitive, true);
  assert.deepEqual(ev.scopes, ["once"]);
  perms.answer(ev.id, { decision: "allow", scope: "project" });
  await p;
  assert.deepEqual(perms.listRules("demo"), [], "nenhuma regra foi criada");
  const again = c.ask("Read", { file_path: path.join(outside, ".env") });
  assert.ok(lastPermission(c.events).id !== ev.id, "pergunta de novo");
  perms.answer(lastPermission(c.events).id, { decision: "deny" });
  await again;
  perms.detachChat(c.id);
});

test("comando: nunca vira regra do projeto; 'conversa' libera só o mesmo comando", async () => {
  const c = chat();
  const p = c.ask("Bash", { command: "docker ps" });
  const ev = lastPermission(c.events);
  assert.equal(ev.kind, "command");
  assert.deepEqual(ev.scopes, ["once", "chat"]);
  perms.answer(ev.id, { decision: "allow", scope: "project" }); // pedido fora do que o cartão oferece: cai em 'uma vez'
  await p;
  assert.deepEqual(perms.listRules("demo"), [], "comando não vira regra do projeto");

  const q = c.ask("Bash", { command: "docker ps" });
  perms.answer(lastPermission(c.events).id, { decision: "allow", scope: "chat" });
  await q;
  assert.deepEqual(await c.ask("Bash", { command: "docker ps" }), { behavior: "allow" });
  const other = c.ask("Bash", { command: "docker rm x" });
  assert.ok(lastPermission(c.events).command === "docker rm x", "outro comando pergunta");
  perms.answer(lastPermission(c.events).id, { decision: "deny" });
  await other;
  perms.detachChat(c.id);
});

test("sem resposta a tempo o pedido é negado; encerrar a conversa nega os abertos", async () => {
  const c = chat();
  const d = await c.ask("Read", readFile(outside));
  assert.equal(d.behavior, "deny");
  assert.ok(c.events.some((e) => e.type === "permission_resolved" && e.scope === "timeout"));

  const c2 = chat();
  const p = c2.ask("Read", readFile(outside));
  perms.detachChat(c2.id);
  assert.equal((await p).behavior, "deny");
  assert.deepEqual(perms.answer("nao-existe", { decision: "allow" }), { ok: false, error: "Pedido não encontrado (já respondido ou expirado)." });
  perms.detachChat(c.id);
});

test("conversa desconhecida e pedido inválido são negados", async () => {
  assert.equal((await perms.request({ chatId: "ninguem", tool: "Read", input: {} })).behavior, "deny");
  const c = chat();
  assert.equal((await c.ask("", {})).behavior, "deny");
  perms.detachChat(c.id);
});

// ---------- ferramenta MCP + rotas, de ponta a ponta (sem o Claude) ----------

test("permission-mcp: o Claude pede, a interface responde pela rota e a decisão volta no formato do CLI", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const c = chat();
  const helper = cp.spawn(process.execPath, [path.join(__dirname, "..", "tools", "permission-mcp.js")], {
    env: { ...process.env, HARNESS_PERM_URL: base, HARNESS_PERM_CHAT: c.id, HARNESS_PERM_TIMEOUT_MS: "5000" },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const lines = [];
  let buf = "";
  helper.stdout.on("data", (d) => { buf += d; const parts = buf.split("\n"); buf = parts.pop() || ""; lines.push(...parts.filter(Boolean).map((l) => JSON.parse(l))); });
  const until = async (cond, ms = 4000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 15)); return cond(); };
  const send = (m) => helper.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
  const answerHttp = (body) => fetch(base + "/api/permissions/answer", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });

  try {
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/list" });
    assert.ok(await until(() => lines.length >= 2));
    assert.equal(lines[0].result.serverInfo.name, "harness-permissions");
    assert.equal(lines[1].result.tools[0].name, "approve");

    // permite
    const input = readFile(outside);
    send({ id: 3, method: "tools/call", params: { name: "approve", arguments: { tool_name: "Read", input } } });
    assert.ok(await until(() => lastPermission(c.events)));
    const ev = lastPermission(c.events);
    assert.equal((await answerHttp({ id: ev.id, decision: "allow", scope: "once" })).status, 200);
    assert.ok(await until(() => lines.some((l) => l.id === 3)));
    const allow = JSON.parse(lines.find((l) => l.id === 3).result.content[0].text);
    assert.deepEqual(allow, { behavior: "allow", updatedInput: input });

    // nega
    send({ id: 4, method: "tools/call", params: { name: "approve", arguments: { tool_name: "Read", input } } });
    assert.ok(await until(() => c.events.filter((e) => e.type === "permission" && !e.auto).length >= 2));
    await answerHttp({ id: lastPermission(c.events).id, decision: "deny" });
    assert.ok(await until(() => lines.some((l) => l.id === 4)));
    const deny = JSON.parse(lines.find((l) => l.id === 4).result.content[0].text);
    assert.equal(deny.behavior, "deny");
    assert.match(deny.message, /negou/);

    // ferramenta desconhecida e método desconhecido
    send({ id: 5, method: "tools/call", params: { name: "outra", arguments: {} } });
    send({ id: 6, method: "nao/existe" });
    assert.ok(await until(() => lines.some((l) => l.id === 5) && lines.some((l) => l.id === 6)));
    assert.ok(lines.find((l) => l.id === 5).error && lines.find((l) => l.id === 6).error);
  } finally {
    helper.kill();
    perms.detachChat(c.id);
    server.closeAllConnections(); server.close();
  }
});

test("permission-mcp sem a interface no ar nega (nunca permite por falha)", async () => {
  const helper = cp.spawn(process.execPath, [path.join(__dirname, "..", "tools", "permission-mcp.js")], {
    env: { ...process.env, HARNESS_PERM_URL: "http://127.0.0.1:1", HARNESS_PERM_CHAT: "x" }, stdio: ["pipe", "pipe", "inherit"],
  });
  const out = await new Promise((resolve) => {
    helper.stdout.once("data", (d) => resolve(JSON.parse(String(d))));
    helper.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "approve", arguments: { tool_name: "Read", input: {} } } }) + "\n");
  });
  helper.kill();
  assert.equal(JSON.parse(out.result.content[0].text).behavior, "deny");
});

test("rotas: resposta inválida, regras do projeto e projeto inexistente", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });
  try {
    assert.equal((await post("/api/permissions/answer", {})).status, 400);
    assert.equal((await post("/api/permissions/answer", { id: "nao-existe", decision: "allow" })).status, 404);
    assert.equal((await post("/api/permissions/request", { chatId: 1 })).status, 400);
    const unknown = await (await post("/api/permissions/request", { chatId: "ninguem", tool: "Read", input: {} })).json();
    assert.equal(unknown.behavior, "deny");
    assert.equal((await fetch(base + "/api/project/nao-existe/permissions")).status, 404);
    assert.deepEqual(await (await fetch(base + "/api/project/demo/permissions")).json(), { allow: [] });
    assert.equal((await post("/api/project/demo/permissions/remove", { index: 3 })).status, 404);
    assert.equal((await fetch(base + "/api/permissions/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403, "POST sem Origin é recusado pela interface");
  } finally { server.closeAllConnections(); server.close(); }
});

// ---------- argumentos do Claude Code ----------

test("claudeSession: com perm liga --permission-prompt-tool e a ferramenta MCP; sem perm nada muda", () => {
  const plain = claudeSession(proj);
  assert.ok(!plain.args.includes("--permission-prompt-tool"));
  assert.ok(!plain.args.includes("--mcp-config"));

  const withPerm = claudeSession(proj, { chatId: "abc", url: "http://127.0.0.1:4321" });
  const i = withPerm.args.indexOf("--permission-prompt-tool");
  assert.equal(withPerm.args[i + 1], "mcp__harness_perm__approve");
  const cfg = JSON.parse(withPerm.args[withPerm.args.indexOf("--mcp-config") + 1]);
  const srv = cfg.mcpServers.harness_perm;
  assert.equal(srv.command, process.execPath);
  assert.ok(fs.existsSync(srv.args[0]), "o script da ferramenta existe");
  assert.deepEqual(srv.env, { HARNESS_PERM_URL: "http://127.0.0.1:4321", HARNESS_PERM_CHAT: "abc" });
  assert.ok(withPerm.args[withPerm.args.indexOf("--allowedTools") + 1].split(",").includes("mcp__harness_perm__approve"));
  assert.ok(withPerm.args.includes("--strict-mcp-config"), "os MCPs do usuário continuam de fora");
});

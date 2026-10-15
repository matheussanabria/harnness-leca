// Testes sem dependências: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const E = require("../tools/lib/engines");
const state = require("../tools/lib/state");
const { redact } = require("../tools/lib/redact");

const PROJECTS = path.resolve(__dirname, "..", "projects");

test("safeModel recusa o que poderia virar comando no shell", () => {
  assert.equal(E.safeModel("sonnet"), "sonnet");
  assert.equal(E.safeModel("gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(E.safeModel("sonnet & calc"), "");
  assert.equal(E.safeModel("x; rm -rf /"), "");
  assert.equal(E.safeModel("$(whoami)"), "");
  assert.equal(E.safeModel(42), "");
});

test("safeEffort só aceita níveis conhecidos", () => {
  assert.equal(E.safeEffort("high"), "high");
  assert.equal(E.safeEffort("max"), "max");
  assert.equal(E.safeEffort("high | calc"), "medium");
  assert.equal(E.safeEffort(undefined), "medium");
});

test("parser do Claude não corta o texto que vem depois de uma ferramenta", () => {
  const chunks = [];
  const p = E.createClaudeStreamParser((c) => chunks.push(c), null);
  const ev = (o) => p.line(JSON.stringify(o));
  ev({ type: "system", session_id: "abc" });
  ev({ type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Vou ler o arquivo agora." }] } });
  ev({ type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Vou ler o arquivo agora." }, { type: "tool_use" }] } });
  ev({ type: "assistant", message: { id: "m2", content: [{ type: "text", text: "Pronto." }] } });
  ev({ type: "result", result: "Pronto." });

  assert.equal(p.text, "Vou ler o arquivo agora.\n\nPronto.");
  assert.equal(p.sessionId, "abc");
  assert.equal(chunks.filter((c) => c.type === "text").map((c) => c.text).join(""), p.text);
});

test("parser do Claude usa o result quando não houve texto em streaming", () => {
  const p = E.createClaudeStreamParser(() => {}, "s0");
  p.line("isto não é json");
  p.line(JSON.stringify({ type: "result", result: "Só o resultado", session_id: "s1" }));
  assert.equal(p.text, "Só o resultado");
  assert.equal(p.sessionId, "s1");
});

test("readChat: trocar ## Claude por ## opencode não muda o hash e conta os turnos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-"));
  const head = "---\nsessao: x\ninicio: \"2026-10-15T00:00:00Z\"\n---\n# T\n\n## Você\n\noi\n\n";
  fs.writeFileSync(path.join(dir, "a.md"), head + "## Claude\n\nolá\n");
  fs.writeFileSync(path.join(dir, "b.md"), head + "## opencode\n\nolá\n");
  const a = state.readChat(path.join(dir, "a.md")), b = state.readChat(path.join(dir, "b.md"));
  assert.equal(a.hash, b.hash);
  assert.equal(b.turnos, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("saveChatToProject: grava agente, não sobrescreve outra conversa e regrava a mesma", (t) => {
  const slug = `zz-teste-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));

  const turns = [{ role: "user", text: "oi" }, { role: "assistant", engine: "opencode", text: "olá" }];
  const s1 = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns, sessionId: "11111111-aaaa-4aaa-8aaa-000000000001" });
  const s2 = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns, sessionId: "22222222-aaaa-4aaa-8aaa-000000000002" });
  assert.notEqual(s1.fileName, s2.fileName);

  const again = E.saveChatToProject({ slug, engine: "claude", title: "Mesmo título", turns: [...turns, { role: "user", text: "mais" }], sessionId: "11111111-aaaa-4aaa-8aaa-000000000001" });
  assert.equal(again.fileName, s1.fileName);
  assert.equal(fs.readdirSync(path.join(PROJECTS, slug, "chats")).length, 2);

  const raw = fs.readFileSync(s1.path, "utf8");
  assert.match(raw, /^agente: "claude"$/m);
  assert.match(raw, /^## opencode$/m, "cada resposta leva o motor que a gerou");
  assert.equal(state.readChat(s1.path).turnos, 3);
});

test("saveChatToProject: sessionId estranho não entra no nome do arquivo", (t) => {
  const slug = `zz-teste-b-${process.pid}`;
  fs.mkdirSync(path.join(PROJECTS, slug, "chats"), { recursive: true });
  t.after(() => fs.rmSync(path.join(PROJECTS, slug), { recursive: true, force: true }));
  const s = E.saveChatToProject({ slug, engine: "gemini", title: "x", turns: [{ role: "user", text: "a" }], sessionId: "../../etc" });
  assert.equal(path.dirname(s.path), path.join(PROJECTS, slug, "chats"));
  assert.match(s.fileName, /^\d{4}-\d{2}-\d{2}-x-[0-9a-f]{8}\.md$/);
});

test("resolveClaudeBin ignora claude.cmd plantado na pasta atual e entradas relativas do PATH", (t) => {
  const B = require("../tools/lib/claude-bin");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-bin-"));
  const real = path.join(dir, "real"), trap = path.join(dir, "trap");
  fs.mkdirSync(real); fs.mkdirSync(trap);
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  fs.writeFileSync(path.join(real, exe), "");
  fs.writeFileSync(path.join(trap, "claude.cmd"), "@echo pwned");
  fs.writeFileSync(path.join(trap, exe), "");
  const env = { PATH: process.env.PATH, CLAUDE_BIN: process.env.CLAUDE_BIN, cwd: process.cwd() };
  t.after(() => {
    process.env.PATH = env.PATH;
    if (env.CLAUDE_BIN === undefined) delete process.env.CLAUDE_BIN; else process.env.CLAUDE_BIN = env.CLAUDE_BIN;
    process.chdir(env.cwd); B.resetClaudeBin();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  delete process.env.CLAUDE_BIN;
  process.chdir(trap);
  process.env.PATH = [".", "", real].join(path.delimiter);
  B.resetClaudeBin();
  assert.equal(B.resolveClaudeBin(), path.join(real, exe));

  process.env.CLAUDE_BIN = "claude-relativo";
  B.resetClaudeBin();
  assert.equal(B.resolveClaudeBin(), path.join(real, exe), "CLAUDE_BIN relativo é ignorado");
});

const argOf = (args, flag) => args[args.indexOf(flag) + 1];

test("claudeSession: sem mcp.json, roda na pasta do projeto, edita e roda comandos, sem MCP", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    const { cwd, args } = E.claudeSession(dir);
    assert.equal(cwd, dir);
    assert.ok(args.includes("--restricted") && args.includes("--strict-mcp-config"));
    assert.equal(argOf(args, "--tools"), "Read,Glob,Grep,Edit,Write,NotebookEdit,Bash,PowerShell");
    assert.equal(argOf(args, "--permission-mode"), "acceptEdits");
    assert.equal(argOf(args, "--allowedTools"), "Bash,PowerShell");
    assert.ok(!args.includes("--mcp-config") && !args.includes("--add-dir"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("claudeSession: modo leitura não edita nem roda comandos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ modo: "leitura" }));
    const { args } = E.claudeSession(dir);
    assert.equal(argOf(args, "--tools"), "Read,Glob,Grep");
    assert.ok(!args.includes("--permission-mode") && !args.includes("--allowedTools"));
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ modo: "tudo" }));
    assert.throws(() => E.claudeSession(dir), /"modo" deve ser/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("claudeSession: com repo, trabalha no repo, lê o projeto e usa só os servidores pedidos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    const repo = path.join(dir, "repo"), proj = path.join(dir, "proj");
    fs.mkdirSync(path.join(repo, "tools", "x"), { recursive: true }); fs.mkdirSync(proj);
    fs.writeFileSync(path.join(repo, "tools", "x", "server.js"), "");
    fs.writeFileSync(path.join(repo, ".mcp.json"), JSON.stringify({ mcpServers: {
      "x-ds": { command: "node", args: ["tools/x/server.js", "--flag"] },
      "outro": { command: "node", args: ["nao-usar.js"] },
    } }));
    fs.writeFileSync(path.join(proj, "mcp.json"), JSON.stringify({ repo, servidores: ["x-ds"] }));

    const { cwd, args } = E.claudeSession(proj);
    assert.equal(cwd, repo);
    assert.equal(argOf(args, "--add-dir"), proj);
    const cfg = JSON.parse(argOf(args, "--mcp-config"));
    assert.deepEqual(Object.keys(cfg.mcpServers), ["x-ds"]);
    assert.deepEqual(cfg.mcpServers["x-ds"].args, [path.join(repo, "tools", "x", "server.js"), "--flag"]);
    assert.equal(argOf(args, "--allowedTools"), "Bash,PowerShell,mcp__x-ds");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("claudeSession: repo inexistente, servidor inexistente ou nome com curinga é erro claro", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ repo: path.join(dir, "nao-existe") }));
    assert.throws(() => E.claudeSession(dir), /repo .* não existe/);
    fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { a: { command: "node" } } }));
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ repo: dir, servidores: ["b"] }));
    assert.throws(() => E.claudeSession(dir), /servidor "b" não está/);
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ mcpServers: { "a*": { command: "node" } } }));
    assert.throws(() => E.claudeSession(dir), /nome de servidor inválido/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("redact remove segredos comuns", () => {
  assert.match(redact("token=abcdef123456"), /\[REDIGIDO\]/);
  assert.doesNotMatch(redact("Authorization: Bearer abcdefghijklmnop"), /abcdefghijklmnop/);
  assert.match(redact("curl -H 'Bearer abcdefghijklmnop'"), /Bearer \[REDIGIDO\]/);
  assert.match(redact("https://user:senha123@host.com"), /user:\[REDIGIDO\]@/);
  assert.equal(redact("texto comum"), "texto comum");
});

// Testes sem dependências: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Raiz temporária: os testes nunca tocam em projects/ nem em global/ de verdade. Tem de vir antes dos require abaixo.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-root-"));
process.env.HARNESS_ROOT = TMP_ROOT;
fs.mkdirSync(path.join(TMP_ROOT, "projects", "dai"), { recursive: true }); // projeto que o teste do servidor usa
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const E = require("../tools/lib/engines");
const state = require("../tools/lib/state");
const { redact } = require("../tools/lib/redact");

const PROJECTS = path.join(TMP_ROOT, "projects");

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

test("claudeSession: sem mcp.json, roda na pasta do projeto com acesso total (sem --restricted), edita e roda comandos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    const { cwd, args } = E.claudeSession(dir);
    assert.equal(cwd, dir);
    assert.ok(!args.includes("--restricted"), "padrão é acesso total (sem confinamento)");
    assert.ok(args.includes("--strict-mcp-config"));
    assert.ok(args.includes("--append-system-prompt"), "inclui diretriz de segurança contra ações destrutivas");
    assert.equal(argOf(args, "--tools"), "Read,Glob,Grep,Edit,Write,NotebookEdit,Bash,PowerShell");
    assert.equal(argOf(args, "--permission-mode"), "acceptEdits");
    assert.equal(argOf(args, "--allowedTools"), "Bash,PowerShell");
    assert.ok(!args.includes("--mcp-config") && !args.includes("--add-dir"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("claudeSession: restrito: true ou modo: 'restrito' ativa --restricted", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-"));
  try {
    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ restrito: true }));
    const { args: args1 } = E.claudeSession(dir);
    assert.ok(args1.includes("--restricted"));

    fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ modo: "restrito" }));
    const { args: args2 } = E.claudeSession(dir);
    assert.ok(args2.includes("--restricted"));
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
    assert.ok(!args.includes("--restricted"), "acesso total por padrão");
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

test("killTree encerra o processo e os filhos que ele abriu", async (t) => {
  const cp = require("child_process");
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  // Pai que abre um neto e imprime o pid dele; os dois ficam vivos até serem mortos.
  const code = "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)";
  const parent = cp.spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const childPid = Number(await new Promise((r) => parent.stdout.once("data", (d) => r(String(d).trim()))));
  t.after(() => {
    try { parent.kill(); } catch {}
    try { process.kill(childPid); } catch {}
  });
  assert.ok(alive(parent.pid) && alive(childPid));

  E.killTree(parent);
  const deadline = Date.now() + 5000;
  while ((alive(parent.pid) || alive(childPid)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  assert.ok(!alive(parent.pid), "o processo principal morreu");
  if (process.platform === "win32") assert.ok(!alive(childPid), "o filho também morreu");
  else try { process.kill(childPid); } catch {}
});

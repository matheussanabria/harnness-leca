// Importadores chamados em memória (run) e o sync que os usa. As fixtures são as mesmas do golden master.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");

// Raiz temporária ANTES de carregar qualquer módulo de tools/: root.js lê HARNESS_ROOT uma vez, ao ser carregado.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-run-"));
process.env.HARNESS_ROOT = TMP_ROOT;
for (const p of ["_template/chats", "demo", "57multimarcas"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { CliError } = require("../tools/lib/cli");
const { SLUG, IMPORTERS, write } = require("./helpers/fixtures");
const claudeCode = require("../tools/import-claude-code-chats");
const opencode = require("../tools/import-opencode-chats");
const gemini = require("../tools/import-gemini-chats");
const claudeAi = require("../tools/import-claude-ai-chats");

const chats = (slug = SLUG) => path.join(TMP_ROOT, "projects", slug, "chats");
const files = (slug) => (fs.existsSync(chats(slug)) ? fs.readdirSync(chats(slug)).sort() : []);
const newHome = (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "harness-home-"));
  for (const slug of [SLUG, "57multimarcas"]) fs.rmSync(chats(slug), { recursive: true, force: true });
  fs.rmSync(path.join(TMP_ROOT, "projects", ".sources.json"), { force: true });
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
};
const io = () => { const lines = []; return { lines, log: (l) => lines.push(l) }; };

test("run() em memória devolve as contagens por estado e escreve o relatório em io.log", (t) => {
  const home = newHome(t);
  IMPORTERS["claude-code"].make(home, "Conversa");
  const args = ["--from", "c--fixture", "--project", SLUG];

  const out1 = io();
  assert.deepEqual(claudeCode.run(args, out1, { home }), { nova: 1, atualizada: 0, igual: 0, ignoradas: 0 });
  assert.ok(out1.lines.some((l) => /\[nova\]/.test(l)));
  assert.equal(files().length, 1);

  assert.deepEqual(claudeCode.run(args, io(), { home }), { nova: 0, atualizada: 0, igual: 1, ignoradas: 0 });

  const dry = io();
  fs.rmSync(chats(), { recursive: true, force: true });
  assert.equal(claudeCode.run([...args, "--dry-run"], dry, { home }).nova, 1);
  assert.deepEqual(files(), [], "dry-run não grava");
});

test("erros de uso viram CliError (nunca process.exit) quando chamado em memória", (t) => {
  const home = newHome(t);
  IMPORTERS["claude-code"].make(home, "Conversa");
  IMPORTERS.opencode.make(home, "Conversa");
  const err = (fn, re) => assert.throws(fn, (e) => e instanceof CliError && re.test(e.message));

  err(() => claudeCode.run([], io(), { home }), /Uso:/);
  err(() => claudeCode.run(["--from", "c--fixture", "--project", "../x"], io(), { home }), /--project inválido/);
  err(() => claudeCode.run(["--from", os.tmpdir(), "--project", SLUG], io(), { home }), /fora de ~\/.claude\/projects/);
  err(() => claudeCode.run(["--from", "nao-existe", "--project", SLUG], io(), { home }), /Nenhuma pasta contém/);
  err(() => opencode.run(["--from", "nada-casa", "--project", SLUG], io(), { home }), /Nenhuma sessão corresponde/);
  err(() => opencode.run(["--from", "x", "--project", SLUG], io(), { home: os.tmpdir() }), /Banco do opencode não encontrado/);
  err(() => gemini.run([], io(), { home }), /Uso:/);
  err(() => gemini.run(["--project", "../x"], io(), { home }), /--project inválido/);
  err(() => claudeAi.run(["--project", SLUG], io()), /Informe --export/);
});

test("opencode: sessionIds importa exatamente essas sessões, numa execução só, e ignora subagentes", (t) => {
  const home = newHome(t);
  IMPORTERS.opencode.make(home, "Conversa");
  const r = opencode.run(["--project", SLUG], io(), { home, sessionIds: ["ses_abc123def456ghi"] });
  assert.deepEqual(r, { nova: 1, atualizada: 0, igual: 0, ignoradas: 0 });
  // A sessão de subagente existe no banco, mas nunca vira conversa (nem por id).
  assert.throws(() => opencode.run(["--project", SLUG], io(), { home, sessionIds: ["ses_abcSUBAGENT0001"] }), CliError);
});

test("gemini: onlyProjects classifica pelo projeto detectado e nunca cria projeto novo", (t) => {
  const home = newHome(t);
  IMPORTERS.gemini.make(home, "Revise"); // o texto cita 57multimarcas: o projeto detectado é esse

  const none = gemini.run([], io(), { home, onlyProjects: new Set([SLUG]) });
  assert.equal(none.nova, 0);
  assert.deepEqual(files("57multimarcas"), [], "projeto fora do conjunto não recebe nada");

  const r = gemini.run([], io(), { home, onlyProjects: new Set(["57multimarcas"]) });
  assert.equal(r.porProjeto["57multimarcas"].nova, 1);
  assert.equal(files("57multimarcas").length, 1);

  // Sessão de um projeto que não existe em projects/ ("outro", detectado por /git/outro/): nunca cria a pasta.
  const stray = [{ type: "USER_INPUT", created_at: "2026-04-02T10:00:00Z", content: "<USER_REQUEST>Abra C:\\git\\outro\\a.ts</USER_REQUEST>" },
    { type: "PLANNER_RESPONSE", created_at: "2026-04-02T10:00:05Z", content: "Certo." }];
  write(path.join(home, ".gemini", "antigravity-ide", "brain", "eeeeeeee-1111-4222-8333-444444444444", ".system_generated", "logs", "transcript.jsonl"),
    stray.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const again = gemini.run([], io(), { home, onlyProjects: new Set(["57multimarcas"]) });
  assert.equal(again.igual, 1, "a sessão do 57multimarcas continua em dia");
  assert.ok(!fs.existsSync(path.join(TMP_ROOT, "projects", "outro")), "projeto desconhecido não é criado");
});

test("gemini: apelido de projects/.sources.json também vale para detectar o projeto", (t) => {
  const home = newHome(t);
  fs.writeFileSync(path.join(TMP_ROOT, "projects", ".sources.json"), JSON.stringify({ [SLUG]: ["apelido-do-demo"] }));
  const session = [{ type: "USER_INPUT", created_at: "2026-04-01T10:00:00Z", content: "<USER_REQUEST>Vamos mexer no apelido-do-demo hoje</USER_REQUEST>" },
    { type: "PLANNER_RESPONSE", created_at: "2026-04-01T10:00:05Z", content: "Certo." }];
  write(path.join(home, ".gemini", "antigravity-ide", "brain", "dddddddd-1111-4222-8333-444444444444", ".system_generated", "logs", "transcript.jsonl"),
    session.map((e) => JSON.stringify(e)).join("\n") + "\n");

  const r = gemini.run([], io(), { home, onlyProjects: new Set([SLUG]) });
  assert.equal(r.porProjeto[SLUG].nova, 1, "sem o apelido, a detecção embutida não acharia projeto nenhum");
});

test("sync: importa os 3 motores em memória, só em projetos que já existem, e é idempotente", (t) => {
  const home = newHome(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const p of ["_template/chats", "57multimarcas"]) fs.mkdirSync(path.join(root, "projects", p), { recursive: true });

  // Os três motores com conversas do projeto 57multimarcas (mais uma pasta do Claude sem projeto, que deve ser ignorada).
  IMPORTERS["claude-code"].make(home, "Conversa");
  fs.renameSync(path.join(home, ".claude", "projects", "c--fixture"), path.join(home, ".claude", "projects", "c--git-57multimarcas"));
  write(path.join(home, ".claude", "projects", "c--git-outro-projeto", "x.jsonl"), "");
  IMPORTERS.gemini.make(home, "Revise");
  IMPORTERS.opencode.make(home, "Conversa");
  const db = new DatabaseSync(path.join(home, ".local", "share", "opencode", "opencode.db"));
  db.exec("UPDATE session SET directory = 'C:/git/57multimarcas'");
  db.close();

  const sync = (...args) => {
    const r = spawnSync(process.execPath, ["--no-warnings", path.join(__dirname, "..", "tools", "sync.js"), "--no-extract", ...args], {
      encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, HARNESS_ROOT: root },
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    return r.stdout;
  };
  const row = (out, engine) => (out.match(new RegExp(`^${engine}\\s+57multimarcas\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`, "m")) || []).slice(1).map(Number);

  const dry = sync("--dry-run");
  assert.deepEqual(row(dry, "claude"), [1, 0, 0]);
  assert.deepEqual(fs.readdirSync(path.join(root, "projects", "57multimarcas")), [], "dry-run não grava");

  const first = sync();
  assert.deepEqual(row(first, "claude"), [1, 0, 0]);
  assert.deepEqual(row(first, "gemini"), [1, 0, 0]);
  assert.deepEqual(row(first, "opencode"), [1, 0, 0]);
  assert.equal(fs.readdirSync(path.join(root, "projects", "57multimarcas", "chats")).length, 3);
  assert.match(first, /pasta\(s\) sem projeto correspondente \(ignoradas\): c--git-outro-projeto/);
  assert.deepEqual(fs.readdirSync(path.join(root, "projects")).sort(), ["57multimarcas", "_template"], "nenhum projeto novo");

  const second = sync();
  assert.deepEqual(row(second, "claude"), [0, 0, 1]);
  assert.deepEqual(row(second, "gemini"), [0, 0, 1]);
  assert.deepEqual(row(second, "opencode"), [0, 0, 1]);
});

// Golden master dos 4 importadores: cada um roda de verdade (processo filho) sobre uma fixture mínima, numa pasta de
// usuário e numa raiz do harness temporárias, e o .md gerado é comparado byte a byte com tests/golden/<nome>.txt.
// É a rede de segurança para refatorar os importadores sem mudar o formato que o resto do harness lê.
//
// Para regravar os arquivos esperados depois de uma mudança DELIBERADA de formato:
//   UPDATE_GOLDEN=1 npm test     (e revise o diff de tests/golden/ antes de commitar)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const TOOLS = path.join(__dirname, "..", "tools");
const GOLDEN = path.join(__dirname, "golden");
const { SLUG, IMPORTERS, LEAKS, write } = require("./helpers/fixtures");
const lf = (s) => s.replace(/\r\n/g, "\n");

// ---------- infraestrutura ----------

function sandbox(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "harness-home-"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-gold-"));
  fs.mkdirSync(path.join(root, "projects", "_template", "chats"), { recursive: true });
  fs.mkdirSync(path.join(root, "projects", SLUG), { recursive: true });
  t.after(() => { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); });
  const chats = path.join(root, "projects", SLUG, "chats");
  const run = (imp, extra = []) => {
    const r = spawnSync(process.execPath, ["--no-warnings", path.join(TOOLS, imp.script), ...imp.args(home), ...extra], {
      encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, HARNESS_ROOT: root },
    });
    assert.equal(r.status, 0, `${imp.script} saiu com ${r.status}:\n${r.stderr}${r.stdout}`);
    return r.stdout;
  };
  const files = () => (fs.existsSync(chats) ? fs.readdirSync(chats).sort() : []);
  const snapshot = () => files().map((n) => `=== ${n}\n${lf(fs.readFileSync(path.join(chats, n), "utf8"))}`).join("\n");
  return { home, root, chats, run, files, snapshot };
}

function expectGolden(name, actual) {
  const file = path.join(GOLDEN, `${name}.txt`);
  if (process.env.UPDATE_GOLDEN) { write(file, actual); return; }
  assert.ok(fs.existsSync(file), `falta ${file}: rode UPDATE_GOLDEN=1 npm test e revise o resultado`);
  assert.equal(actual, lf(fs.readFileSync(file, "utf8")));
}

// ---------- testes (os mesmos para os 4 importadores) ----------

for (const [name, imp] of Object.entries(IMPORTERS)) {
  test(`${name}: gera o .md esperado, redige dados pessoais e é idempotente`, (t) => {
    const sb = sandbox(t);
    imp.make(sb.home, "Título original");

    const out1 = sb.run(imp);
    assert.match(out1, /\[nova\]/);
    const snap = sb.snapshot();
    expectGolden(name, snap);
    for (const leak of LEAKS) assert.ok(!snap.includes(leak), `vazou ${leak}`);

    const out2 = sb.run(imp);
    assert.ok(!/\[nova\]|\[atualizada\]/.test(out2) && /\[sem mudança\]/.test(out2), "segunda execução não muda nada");
    assert.equal(sb.snapshot(), snap);
  });

  test(`${name}: título novo renomeia o arquivo da mesma sessão sem duplicar`, (t) => {
    const sb = sandbox(t);
    imp.make(sb.home, "Título original");
    sb.run(imp);
    const before = sb.files();

    imp.make(sb.home, "Título novo e diferente");
    // O nome do arquivo leva o título: com título novo o arquivo é "nova" e o antigo da mesma sessão é removido.
    const out = sb.run(imp);
    assert.match(out, /\[nova\]/);
    const after = sb.files();
    assert.equal(after.length, before.length, `duplicou: ${after.join(", ")}`);
    assert.notDeepEqual(after, before, "o nome acompanha o título");
  });

  test(`${name}: --dry-run não grava nada`, (t) => {
    const sb = sandbox(t);
    imp.make(sb.home, "Título original");
    const out = sb.run(imp, ["--dry-run"]);
    assert.match(out, /dry-run/);
    assert.deepEqual(sb.files(), []);
  });
}

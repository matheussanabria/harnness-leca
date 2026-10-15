// Controle de extração: regras puras (extraction.js) e o armazenamento em disco (state.js), com raiz temporária.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-ext-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const { statusOf, renderTable } = require("../tools/lib/extraction");
const state = require("../tools/lib/state");

const chat = (sessao, extra = "") => `---\ntitulo: "T ${sessao}"\nsessao: ${sessao}\ninicio: 2026-01-0${sessao.length}T00:00:00Z\nfim: 2026-01-0${sessao.length}T01:00:00Z\n---\n# T\n\n## Você\n\noi${extra}\n\n## Claude\n\nolá\n`;
function project(t, name) {
  const dir = path.join(TMP_ROOT, "projects", name);
  fs.mkdirSync(path.join(dir, "chats"), { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, chats: path.join(dir, "chats"), stateFile: path.join(dir, "extraction-state.json"), table: path.join(dir, "context", "extraido-conversas.md") };
}

test("statusOf: nova, em dia, alterada e adoção de entrada antiga", () => {
  assert.deepEqual(statusOf(undefined, { hash: "h", turnos: 2 }), { status: "nova", adopt: false });
  assert.deepEqual(statusOf({ v: 2, hash: "h", turnos: 2 }, { hash: "h", turnos: 2 }), { status: "ok", adopt: false });
  assert.deepEqual(statusOf({ v: 2, hash: "velho", turnos: 2 }, { hash: "h", turnos: 4 }), { status: "alterada", adopt: false });
  assert.deepEqual(statusOf({ v: 2, hash: "velho", turnos: 2 }, { hash: "h", turnos: 2 }), { status: "alterada", adopt: false }, "entrada atual: mesmo nº de turnos com conteúdo diferente É alteração");
  assert.deepEqual(statusOf({ hash: "velho", turnos: 2 }, { hash: "h", turnos: 2 }), { status: "ok", adopt: true }, "entrada antiga (sem v): adota o hash novo");
  assert.deepEqual(statusOf({ hash: "velho", turnos: 2 }, { hash: "h", turnos: 3 }), { status: "alterada", adopt: false });
});

test("renderTable: pura, com contagens, status e título seguro para Markdown", () => {
  const rows = [
    { name: "a.md", titulo: "Com | barra\nquebra", data: "2026-01-01", turnos: 4, status: "alterada", antes: { turnos: 2, por: "gemini", analisadoEm: "2026-01-02T00:00:00Z" } },
    { name: "b.md", titulo: "Nova", data: "", turnos: 2, status: "nova", antes: null },
    { name: "c.md", titulo: "Em dia", data: "2026-01-03", turnos: 6, status: "ok", antes: { turnos: 6, por: "claude", analisadoEm: "2026-01-04T00:00:00Z" } },
  ];
  const md = renderTable("demo", rows, "2026-10-15");
  assert.match(md, /em 2026-10-15\./);
  assert.match(md, /\*\*Total de conversas:\*\* 3/);
  assert.match(md, /\*\*Em dia \(analisadas\):\*\* 1/);
  assert.match(md, /\*\*Alteradas .*:\*\* 1/);
  assert.match(md, /\| 1 \| \[Com \\- barra quebra\]\(\.\.\/chats\/a\.md\) \| `a\.md` \| 2026-01-01 \| 2 → 4 \| ↻ Alterada \| gemini \| 2026-01-02 \|/);
  assert.match(md, /\| 2 \| \[Nova\]\(\.\.\/chats\/b\.md\) \| `b\.md` \| - \| 2 \| ⏳ Pendente \| - \| - \|/);
  assert.equal(renderTable("demo", [], "2026-10-15"), "");
  assert.equal(renderTable("demo", rows, "2026-10-15"), md, "mesma entrada, mesma saída");
});

test("scan é só leitura; migrateLegacy grava o hash novo uma vez", (t) => {
  const p = project(t, "p-scan");
  fs.writeFileSync(path.join(p.chats, "a.md"), chat("aaa"));
  fs.writeFileSync(path.join(p.chats, "b.md"), chat("bbb"));
  const a = state.readChat(path.join(p.chats, "a.md"));
  // aaa: entrada antiga (sem v, hash do arquivo inteiro, mesmo nº de turnos). bbb: entrada atual, em dia.
  const b = state.readChat(path.join(p.chats, "b.md"));
  const initial = JSON.stringify({ version: 1, sessoes: {
    aaa: { arquivo: "a.md", hash: "hash-do-arquivo-inteiro", turnos: a.turnos, por: "gemini" },
    bbb: { v: 2, arquivo: "b.md", hash: b.hash, turnos: b.turnos, por: "claude" },
  } });
  fs.writeFileSync(p.stateFile, initial);

  const rows = state.scan("p-scan");
  assert.deepEqual(rows.map((r) => [r.sessao, r.status]).sort(), [["aaa", "ok"], ["bbb", "ok"]], "a entrada antiga conta como em dia");
  assert.equal(fs.readFileSync(p.stateFile, "utf8"), initial, "scan não grava nada");
  assert.ok(!fs.existsSync(p.table), "scan não grava a tabela");

  assert.equal(state.migrateLegacy("p-scan"), 1);
  const saved = JSON.parse(fs.readFileSync(p.stateFile, "utf8")).sessoes;
  assert.deepEqual([saved.aaa.v, saved.aaa.hash], [2, a.hash]);
  assert.equal(saved.aaa.por, "gemini", "o resto da entrada fica como estava");
  assert.equal(state.migrateLegacy("p-scan"), 0, "segunda vez não há mais o que migrar");

  // Depois de migrada, uma mudança de conteúdo com o mesmo nº de turnos É detectada (antes ficava escondida).
  fs.writeFileSync(path.join(p.chats, "a.md"), chat("aaa", " e mais um pouco"));
  assert.equal(state.scan("p-scan").find((r) => r.sessao === "aaa").status, "alterada");
});

test("mark só atualiza o estado; writeTable grava a tabela", (t) => {
  const p = project(t, "p-mark");
  fs.mkdirSync(path.join(p.dir, "context"));
  fs.writeFileSync(path.join(p.chats, "a.md"), chat("aaa"));

  assert.deepEqual(state.mark("p-mark", ["a.md"], "teste"), ["a.md"]);
  assert.equal(JSON.parse(fs.readFileSync(p.stateFile, "utf8")).sessoes.aaa.por, "teste");
  assert.ok(!fs.existsSync(p.table), "mark não regrava a tabela como efeito colateral");
  assert.throws(() => state.mark("p-mark", ["nao-existe.md"], "x"), /chat não encontrado/);
  assert.deepEqual(state.mark("p-mark", ["../../a.md"], "x"), ["a.md"], "basename: sem path traversal");

  const md = state.writeTable("p-mark");
  assert.equal(fs.readFileSync(p.table, "utf8"), md);
  assert.match(md, /\*\*Em dia \(analisadas\):\*\* 1/);
});

test("writeTable não cria context/ nem grava quando não há conversas", (t) => {
  const p = project(t, "p-vazio");
  assert.equal(state.writeTable("p-vazio"), "");
  assert.ok(!fs.existsSync(path.join(p.dir, "context")));
  fs.writeFileSync(path.join(p.chats, "a.md"), chat("aaa"));
  assert.match(state.writeTable("p-vazio"), /Total de conversas/);
  assert.ok(!fs.existsSync(p.table), "sem a pasta context/, devolve o texto mas não grava");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { makeTempDir } = require("./helpers/temp-dir");

const { initPrototype, savePrototypeFiles, getPrototypesBaseDir } = require("../ui/server/services/prototype-storage.service");
const H = require("../ui/server/services/prototype-history.service");

function setup() {
  const projectDir = makeTempDir("proto-hist-", test);
  initPrototype(projectDir, "p1", "P1", {});
  const protoDir = path.join(getPrototypesBaseDir(projectDir), "p1");
  return { projectDir, protoDir, screen: path.join(protoDir, "screens", "home.html"), css: path.join(protoDir, "styles", "proto.css") };
}
const write = (file, text) => fs.writeFileSync(file, text, "utf8");
const read = (file) => fs.readFileSync(file, "utf8");

test("withHistory cria o estado inicial e uma entrada por alteração; desfazer e refazer restauram os arquivos", () => {
  const { projectDir, screen, css } = setup();
  const original = read(screen);
  H.withHistory(projectDir, "p1", { label: "Editar texto" }, () => { write(screen, "<p>A</p>"); return { ok: true }; });
  H.withHistory(projectDir, "p1", { label: "Alterar estilo" }, () => { write(screen, "<p>B</p>"); write(css, "p{color:red}"); return { ok: true }; });

  const list = H.listHistory(projectDir, "p1");
  assert.deepEqual(list.entries.map((e) => e.label), ["Estado inicial", "Editar texto", "Alterar estilo"]);
  assert.equal(list.cursor, 2);
  assert.equal(list.canUndo, true);
  assert.equal(list.canRedo, false);
  assert.deepEqual(list.entries[2].changed, ["screens/home.html", "styles/proto.css"]);

  assert.equal(H.undoHistory(projectDir, "p1").ok, true);
  assert.equal(read(screen), "<p>A</p>");
  assert.equal(read(css).includes("color:red"), false);
  assert.equal(H.undoHistory(projectDir, "p1").ok, true);
  assert.equal(read(screen), original);
  assert.equal(H.undoHistory(projectDir, "p1").ok, false);

  assert.equal(H.redoHistory(projectDir, "p1").ok, true);
  assert.equal(read(screen), "<p>A</p>");
  assert.equal(H.goToEntry(projectDir, "p1", 2).ok, true);
  assert.equal(read(screen), "<p>B</p>");
  assert.equal(H.redoHistory(projectDir, "p1").ok, false);
});

test("uma alteração nova depois de desfazer descarta o refazer", () => {
  const { projectDir, screen } = setup();
  H.withHistory(projectDir, "p1", { label: "A" }, () => { write(screen, "A"); return { ok: true }; });
  H.withHistory(projectDir, "p1", { label: "B" }, () => { write(screen, "B"); return { ok: true }; });
  H.undoHistory(projectDir, "p1");
  H.withHistory(projectDir, "p1", { label: "C" }, () => { write(screen, "C"); return { ok: true }; });
  const list = H.listHistory(projectDir, "p1");
  assert.deepEqual(list.entries.map((e) => e.label), ["Estado inicial", "A", "C"]);
  assert.equal(list.canRedo, false);
});

test("alteração gravada fora do histórico entra como Alteração externa e pode ser desfeita", () => {
  const { projectDir, screen } = setup();
  const original = read(screen);
  H.listHistory(projectDir, "p1");
  write(screen, "<p>mexeu por fora</p>");
  const list = H.listHistory(projectDir, "p1");
  assert.equal(list.entries[list.cursor].label, "Alteração externa");
  assert.equal(H.undoHistory(projectDir, "p1").ok, true);
  assert.equal(read(screen), original);
});

test("falha ou erro dentro de withHistory não cria entrada", () => {
  const { projectDir, screen } = setup();
  H.withHistory(projectDir, "p1", { label: "ok" }, () => { write(screen, "1"); return { ok: true }; });
  H.withHistory(projectDir, "p1", { label: "falhou" }, () => ({ ok: false, error: "x" }));
  assert.throws(() => H.withHistory(projectDir, "p1", { label: "erro" }, () => { throw new Error("boom"); }), /boom/);
  assert.deepEqual(H.listHistory(projectDir, "p1").entries.map((e) => e.label), ["Estado inicial", "ok"]);
});

test("criar e apagar arquivos entra no histórico e volta ao desfazer", () => {
  const { projectDir, protoDir } = setup();
  const extra = path.join(protoDir, "screens", "nova.html");
  H.withHistory(projectDir, "p1", { label: "Nova tela" }, () => { write(extra, "<p>nova</p>"); return { ok: true }; });
  assert.equal(fs.existsSync(extra), true);
  H.undoHistory(projectDir, "p1");
  assert.equal(fs.existsSync(extra), false);
  H.redoHistory(projectDir, "p1");
  assert.equal(read(extra), "<p>nova</p>");
});

test("restaurar o proto.json mantém a versão atual (a numeração de versões não volta)", () => {
  const { projectDir, protoDir } = setup();
  H.listHistory(projectDir, "p1");
  savePrototypeFiles(projectDir, "p1", [{ path: "screens/home.html", content: "<p>v2</p>" }], { message: "v2" });
  const live = JSON.parse(read(path.join(protoDir, "proto.json")));
  H.listHistory(projectDir, "p1"); // registra a alteração externa
  H.undoHistory(projectDir, "p1");
  const after = JSON.parse(read(path.join(protoDir, "proto.json")));
  assert.equal(after.version, live.version);
  assert.equal(read(path.join(protoDir, "screens", "home.html")).includes("v2"), false);
});

test("sem alteração real não cria entrada e entradas além do limite saem do começo", () => {
  const { projectDir, screen } = setup();
  H.withHistory(projectDir, "p1", { label: "igual" }, () => ({ ok: true }));
  assert.equal(H.listHistory(projectDir, "p1").entries.length, 1);
  for (let i = 0; i < H.MAX_ENTRIES + 5; i += 1) H.withHistory(projectDir, "p1", { label: `n${i}` }, () => { write(screen, `v${i}`); return { ok: true }; });
  const list = H.listHistory(projectDir, "p1");
  assert.equal(list.entries.length, H.MAX_ENTRIES);
  assert.equal(list.entries[list.entries.length - 1].label, `n${H.MAX_ENTRIES + 4}`);
  assert.equal(H.undoHistory(projectDir, "p1").ok, true);
});

test("id de protótipo inválido ou inexistente falha com erro claro", () => {
  const { projectDir } = setup();
  assert.throws(() => H.listHistory(projectDir, "../x"), /inválido/);
  assert.throws(() => H.listHistory(projectDir, "nao-existe"), /não encontrado/);
});

test("ponto nomeado não cria entrada, aparece no resumo e sobrevive ao limite de entradas", () => {
  const { projectDir, screen } = setup();
  H.withHistory(projectDir, "p1", { label: "A" }, () => { write(screen, "<p>0</p>"); return { ok: true }; });
  const marked = H.markCheckpoint(projectDir, "p1", "Antes de mexer");
  assert.equal(marked.ok, true);
  assert.equal(marked.entries.length, 2);
  assert.equal(marked.entries[1].checkpoint, "Antes de mexer");
  for (let i = 1; i <= H.MAX_ENTRIES + 5; i += 1) H.withHistory(projectDir, "p1", { label: `n${i}` }, () => { write(screen, `<p>${i}</p>`); return { ok: true }; });
  const list = H.listHistory(projectDir, "p1");
  assert.equal(list.entries.length, H.MAX_ENTRIES);
  assert.ok(list.entries.some((e) => e.checkpoint === "Antes de mexer"));
  const idx = list.entries.findIndex((e) => e.checkpoint);
  assert.equal(H.goToEntry(projectDir, "p1", idx).ok, true);
  assert.equal(read(screen), "<p>0</p>");
  assert.equal(H.markCheckpoint(projectDir, "p1", "", idx).entries[idx].checkpoint, "");
  assert.equal(H.markCheckpoint(projectDir, "p1", "x", 9999).ok, false);
});

test("rótulos de exclusão e duplicação em lote", () => {
  assert.equal(H.labelForStructuralOp({ type: "remove", pids: ["a", "b", "c"] }), "Excluir 3 elementos");
  assert.equal(H.labelForStructuralOp({ type: "duplicate", pids: ["a"] }), "Duplicar elemento");
});

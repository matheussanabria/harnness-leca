const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { deletePrototype } = require("../ui/server/services/prototype-delete.service");
const { listProjectPrototypes } = require("../ui/server/services/prototype-storage.service");

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proto-del-"));
  for (const id of ["a", "b"]) {
    const p = path.join(dir, "design", "prototypes", id);
    fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, "proto.json"), JSON.stringify({ id, title: id, screens: [] }));
  }
  fs.writeFileSync(path.join(dir, "design", "design.json"), JSON.stringify({
    schema: 1,
    project: "x",
    prototypes: [
      { id: "a", title: "A", file: "design/prototypes/a/proto.json" },
      { id: "art", title: "Artefato", file: "design/art.html" },
    ],
  }));
  return dir;
}

test("exclui protótipo do Ateliê: pasta vai para a lixeira e some do catálogo e do design.json", () => {
  const dir = makeProject();
  const res = deletePrototype(dir, "a", { fs, path, now: () => 123 });
  assert.equal(res.removedFolder, "design/prototypes/a");
  assert.equal(res.removedEntry, true);
  assert.equal(res.trash, "design/prototypes/.trash/a-123");
  assert.ok(fs.existsSync(path.join(dir, "design", "prototypes", ".trash", "a-123", "proto.json")), "recuperável");
  assert.deepEqual(listProjectPrototypes(dir).map((p) => p.id), ["b"]);
  const json = JSON.parse(fs.readFileSync(path.join(dir, "design", "design.json"), "utf8"));
  assert.deepEqual(json.prototypes.map((p) => p.id), ["art"]);
  assert.equal(json.project, "x");
});

test("exclui só a entrada de um artefato do design.json, sem tocar no arquivo", () => {
  const dir = makeProject();
  fs.writeFileSync(path.join(dir, "design", "art.html"), "<p>oi</p>");
  const res = deletePrototype(dir, "art", { fs, path });
  assert.equal(res.removedFolder, null);
  assert.equal(res.removedEntry, true);
  assert.ok(fs.existsSync(path.join(dir, "design", "art.html")));
});

test("pasta sem entrada no design.json também é excluída", () => {
  const dir = makeProject();
  const res = deletePrototype(dir, "b", { fs, path });
  assert.equal(res.removedFolder, "design/prototypes/b");
  assert.equal(res.removedEntry, false);
});

test("id inexistente ou malicioso dá erro", () => {
  const dir = makeProject();
  assert.throws(() => deletePrototype(dir, "nada"), /não encontrado/);
  assert.throws(() => deletePrototype(dir, "../x"), /inválido/);
  assert.throws(() => deletePrototype(dir, ".trash"), /inválido|não encontrado/);
});

test("se o rename falha com EPERM (arquivo aberto no Windows), copia para a lixeira e remove a original", () => {
  const dir = makeProject();
  const flaky = Object.assign(Object.create(fs), {
    renameSync() { throw Object.assign(new Error("busy"), { code: "EPERM" }); },
  });
  const res = deletePrototype(dir, "b", { fs: flaky, path, now: () => 7 });
  assert.equal(res.trash, "design/prototypes/.trash/b-7");
  assert.ok(fs.existsSync(path.join(dir, "design", "prototypes", ".trash", "b-7", "proto.json")));
  assert.ok(!fs.existsSync(path.join(dir, "design", "prototypes", "b")));
});

test("se nem copiar e remover funciona, nada é perdido e o erro explica", () => {
  const dir = makeProject();
  const stuck = Object.assign(Object.create(fs), {
    renameSync() { throw Object.assign(new Error("busy"), { code: "EBUSY" }); },
    rmSync(p, o) { if (String(p).endsWith(path.join("prototypes", "b"))) throw Object.assign(new Error("busy"), { code: "EBUSY" }); return fs.rmSync(p, o); },
  });
  assert.throws(() => deletePrototype(dir, "b", { fs: stuck, path, now: () => 9 }), /Não foi possível/);
  assert.ok(fs.existsSync(path.join(dir, "design", "prototypes", "b", "proto.json")), "original intacta");
  assert.ok(!fs.existsSync(path.join(dir, "design", "prototypes", ".trash", "b-9")), "sem lixo parcial");
});

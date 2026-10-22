// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { writeManagedBlock, writeGenerated, BEGIN, END, GENERATED } = require("../tools/lib/export/managed-file");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "managed-file-test-"));
}

test("writeManagedBlock: cria o arquivo quando não existe", () => {
  const f = path.join(tmp(), "sub", "MEMORY.md");
  const r = writeManagedBlock(f, "ponteiro");
  assert.equal(r.status, "created");
  assert.equal(fs.readFileSync(f, "utf8"), `${BEGIN}\nponteiro\n${END}\n`);
});

test("writeManagedBlock: acrescenta ao fim e preserva o conteúdo de fora byte a byte", () => {
  const f = path.join(tmp(), "MEMORY.md");
  const original = "# Memória\r\n- fato escrito pelo Claude\r\n\r\nfim sem quebra";
  fs.writeFileSync(f, original);
  writeManagedBlock(f, "v1");
  const after = fs.readFileSync(f, "utf8");
  assert.ok(after.startsWith(original));
  assert.ok(after.includes(`${BEGIN}\nv1\n${END}`));
});

test("writeManagedBlock: substitui só o bloco existente, mantendo antes e depois", () => {
  const f = path.join(tmp(), "MEMORY.md");
  fs.writeFileSync(f, `antes\n${BEGIN}\nvelho\n${END}\ndepois\n`);
  writeManagedBlock(f, "novo");
  assert.equal(fs.readFileSync(f, "utf8"), `antes\n${BEGIN}\nnovo\n${END}\ndepois\n`);
});

test("writeManagedBlock: idempotente em duas execuções", () => {
  const f = path.join(tmp(), "MEMORY.md");
  fs.writeFileSync(f, "- linha do Claude\n");
  writeManagedBlock(f, "ponteiro");
  const first = fs.readFileSync(f, "utf8");
  const r = writeManagedBlock(f, "ponteiro");
  assert.equal(r.status, "unchanged");
  assert.equal(fs.readFileSync(f, "utf8"), first);
});

test("writeManagedBlock: marcador de abertura sem fechamento não altera o arquivo", () => {
  const f = path.join(tmp(), "MEMORY.md");
  const broken = `texto\n${BEGIN}\nsem fim\n`;
  fs.writeFileSync(f, broken);
  const r = writeManagedBlock(f, "x", { log: () => {} });
  assert.equal(r.status, "skipped");
  assert.equal(fs.readFileSync(f, "utf8"), broken);
});

test("writeManagedBlock: dry-run não grava", () => {
  const f = path.join(tmp(), "MEMORY.md");
  writeManagedBlock(f, "x", { dryRun: true });
  assert.equal(fs.existsSync(f), false);
});

test("writeGenerated: não reescreve arquivo sem harness:generated e avisa", () => {
  const f = path.join(tmp(), "a.md");
  fs.writeFileSync(f, "escrito à mão");
  const logs = [];
  const r = writeGenerated(f, "# Novo\n", { log: (m) => logs.push(m) });
  assert.equal(r.status, "skipped");
  assert.equal(fs.readFileSync(f, "utf8"), "escrito à mão");
  assert.equal(logs.length, 1);
});

test("writeGenerated: cria e reescreve arquivo marcado, de forma idempotente", () => {
  const f = path.join(tmp(), "b.md");
  assert.equal(writeGenerated(f, "# T\ncorpo\n").status, "created");
  assert.ok(fs.readFileSync(f, "utf8").includes(GENERATED));
  assert.equal(writeGenerated(f, "# T\ncorpo\n").status, "unchanged");
  assert.equal(writeGenerated(f, "# T\noutro\n").status, "updated");
  assert.ok(fs.readFileSync(f, "utf8").includes("outro"));
});

test("writeGenerated: JSON recebe o marcador no campo generator", () => {
  const f = path.join(tmp(), "m.json");
  writeGenerated(f, JSON.stringify({ id: "x" }));
  const obj = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.equal(obj.generator, GENERATED);
  assert.equal(writeGenerated(f, JSON.stringify({ id: "y" })).status, "updated");
});

test("writeManagedBlock: arquivo legado gerado pelo export antigo é substituído pelo bloco", () => {
  const f = path.join(tmp(), "MEMORY.md");
  fs.writeFileSync(f, "# Memória do Projeto: demo\n- [2026-10-19] fato antigo\n");
  const r = writeManagedBlock(f, "ponteiro", { legacy: [/^# Memória do Projeto: /m] });
  assert.equal(r.status, "updated");
  assert.equal(fs.readFileSync(f, "utf8"), `${BEGIN}\nponteiro\n${END}\n`);
});

test("writeManagedBlock: arquivo com conteúdo próprio e sem cabeçalho legado continua preservado", () => {
  const f = path.join(tmp(), "MEMORY.md");
  fs.writeFileSync(f, "- fato do Claude Code\n");
  writeManagedBlock(f, "ponteiro", { legacy: [/^# Memória do Projeto: /m] });
  assert.ok(fs.readFileSync(f, "utf8").startsWith("- fato do Claude Code\n"));
});

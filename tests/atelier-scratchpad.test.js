// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  sanitizeScratchFilename,
  getScratchDir,
  writeScratchFile,
  readScratchFile,
  listScratchFiles,
  cleanScratchDir,
} = require("../ui/server/services/atelier-scratchpad.service");

test("atelier-scratchpad: sanitizeScratchFilename valida nomes e bloqueia path traversal", () => {
  assert.equal(sanitizeScratchFilename("plan.json"), "plan.json");
  assert.equal(sanitizeScratchFilename("wireframe-1.html"), "wireframe-1.html");
  assert.equal(sanitizeScratchFilename("notes.md"), "notes.md");

  assert.throws(() => sanitizeScratchFilename("../secret.txt"), /caracteres proibidos/);
  assert.throws(() => sanitizeScratchFilename("sub/plan.json"), /caracteres proibidos/);
  assert.throws(() => sanitizeScratchFilename("c:\\windows\\win.ini"), /caracteres proibidos/);
  assert.throws(() => sanitizeScratchFilename(""), /caracteres proibidos/);
  assert.throws(() => sanitizeScratchFilename(null), /Nome de arquivo inválido/);
});

test("atelier-scratchpad: ciclo completo de escrita, leitura, listagem e limpeza", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scratch-test-"));
  t.after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const protoDir = path.join(tmpDir, "design", "prototypes", "proto-demo");
  fs.mkdirSync(protoDir, { recursive: true });

  // 1. Diretório é criado sob demanda
  const scratchDir = getScratchDir(tmpDir, "proto-demo");
  assert.ok(fs.existsSync(scratchDir));
  assert.equal(scratchDir, path.join(protoDir, "scratch"));

  // 2. Escrita de arquivos
  const w1 = writeScratchFile(tmpDir, "proto-demo", "plan.json", { steps: ["step1", "step2"] });
  assert.equal(w1.ok, true);
  assert.equal(w1.filename, "plan.json");

  const w2 = writeScratchFile(tmpDir, "proto-demo", "notes.md", "# Briefing Notes\nLinha 1");
  assert.equal(w2.ok, true);
  assert.equal(w2.filename, "notes.md");

  // 3. Leitura
  const r1 = readScratchFile(tmpDir, "proto-demo", "plan.json");
  assert.ok(r1.content.includes("step1"));
  const parsed = JSON.parse(r1.content);
  assert.deepEqual(parsed.steps, ["step1", "step2"]);

  const r2 = readScratchFile(tmpDir, "proto-demo", "notes.md");
  assert.ok(r2.content.includes("# Briefing Notes"));

  // 4. Listagem ordenada
  const list = listScratchFiles(tmpDir, "proto-demo");
  assert.equal(list.length, 2);
  assert.equal(list[0].filename, "notes.md");
  assert.equal(list[1].filename, "plan.json");

  // 5. Limpeza
  const clean = cleanScratchDir(tmpDir, "proto-demo");
  assert.equal(clean.ok, true);
  assert.equal(clean.removed, 2);
  assert.equal(listScratchFiles(tmpDir, "proto-demo").length, 0);
});

test("atelier-scratchpad: falha ao acessar protótipo inexistente", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scratch-test-inexistente-"));
  try {
    assert.throws(() => getScratchDir(tmpDir, "inexistente"), /não encontrado/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

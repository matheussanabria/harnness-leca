'use strict';
// Phase 0 safety net for the traceability gate (rastreio): a frozen baseline of the real project
// plus one provoked defect per gate G1..G9. Runs against the legacy gate today; phase 1 swaps the
// runner in tests/helpers/rastreio-fixture.js and these cases must keep passing unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildProject, runGate, legacyAvailable, runnerAvailable, find, ALFA, PKG, LEGACY_DIR,
} = require('./helpers/rastreio-fixture');

const skip = runnerAvailable() ? false : 'legacy rastreio gate not found (set RASTREIO_LEGACY_DIR)';
// The baseline test reads the real project, so it needs that folder whatever the runner.
const skipReal = fs.existsSync(path.join(LEGACY_DIR, 'doc', 'sistema', 'features')) ? false : 'saude/dispensacao not found (set RASTREIO_LEGACY_DIR)';
const NEW_CLI = path.join(__dirname, '..', 'tools', 'rastreio', 'cli.mjs');
const BASELINE = path.join(__dirname, 'fixtures', 'rastreio', 'saude-dispensacao-baseline.json');
const TEST_JAVA = `dispensacao-novo/dispensacao-api/src/test/java/${PKG}/servico/FooTest.java`;

function mut(edit) {
  const root = buildProject(edit);
  try { return runGate(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const msgs = (run, slug, kind, g) => (find(run, slug)?.[kind] || []).filter((x) => x.g === g).map((x) => x.m);

test('baseline: real project output is identical to the frozen one', { skip: skipReal }, () => {
  const legacy = process.env.RASTREIO_RUNNER === 'legacy';
  const args = legacy ? ['tools/doc-features/rastreio.mjs', '--json'] : [NEW_CLI, '--root', LEGACY_DIR, '--json'];
  const r = spawnSync(process.execPath, args, { cwd: LEGACY_DIR, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(r.status, 0);
  const frozen = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  assert.equal(frozen.length, 22);
  assert.deepEqual(JSON.parse(r.stdout), frozen);
  for (const f of frozen) assert.deepEqual([f.erros, f.avisos], [[], []], f.slug);
});

test('fixture project is clean (no errors, no warnings)', { skip }, () => {
  const run = mut();
  assert.equal(run.code, 0, run.stderr);
  for (const slug of ['alfa', 'beta']) {
    assert.deepEqual([find(run, slug).erros, find(run, slug).avisos], [[], []], slug);
  }
  assert.deepEqual(find(run, 'alfa').resumo, { entradas: 3, regras: 2, semProva: 0, testesSemElo: 0 });
});

test('G1: entry without proof and without declared gap', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, '    junit: [FooTest#deveFazer]\n    regras: [RN-alfa-001]\n  C2', '    regras: [RN-alfa-001]\n  C2'));
  assert.equal(run.code, 1);
  assert.match(msgs(run, 'alfa', 'erros', 'G1')[0], /^C1: sem prova/);
});

test('G1: gap without reason', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, '    junit: [FooTest#deveFazer]\n    regras: [RN-alfa-001]\n  C2', '    lacunas: [{}]\n  C2'));
  assert.match(msgs(run, 'alfa', 'erros', 'G1').join('|'), /C1: lacuna sem motivo/);
});

test('G2: rule without code', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'RN-alfa-001: { codigo: [servico/Foo.java] }', 'RN-alfa-001: {}'));
  assert.deepEqual(msgs(run, 'alfa', 'erros', 'G2'), ['RN-alfa-001: sem `codigo`']);
});

test('G2: rule with no cited proof and no sem_prova', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'RN-alfa-002: { codigo: ["web:foo.ts"] }', 'RN-alfa-002: { codigo: ["web:foo.ts"] }\n  RN-alfa-003: { codigo: [servico/Foo.java] }'));
  assert.match(msgs(run, 'alfa', 'erros', 'G2').join('|'), /RN-alfa-003: nenhuma entrada com prova/);
});

test('G3: entry cites a rule that is not defined', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'regras: [RN-alfa-002]', 'regras: [RN-alfa-002, RN-alfa-009]'));
  assert.match(msgs(run, 'alfa', 'erros', 'G3').join('|'), /C2: cita RN-alfa-009/);
});

test('G3: cobertos_por points to a missing entry of another feature', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'requisitos:', 'requisitos:\n  R2:\n    cobertos_por: [beta/ZZ]'));
  assert.match(msgs(run, 'alfa', 'erros', 'G3').join('|'), /R2: cobertos_por cita beta\/ZZ, que nao existe|R2: cobertos_por cita beta\/ZZ/);
});

test('G3: rule in the YAML without a row in regras.md', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/regras.md`, '| RN-alfa-002 | Regra dois |\n', ''));
  assert.match(msgs(run, 'alfa', 'erros', 'G3').join('|'), /RN-alfa-002: est. no YAML, mas n.o tem linha em regras\.md/);
});

test('G4: JUnit test that does not exist', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'FooTest#deveFazer', 'FooTest#naoExiste'));
  assert.match(msgs(run, 'alfa', 'erros', 'G4').join('|'), /C1: teste inexistente: FooTest#naoExiste/);
});

test('G4: Karma title missing, Postman request missing, code file missing', { skip }, () => {
  const run = mut((f) => {
    f.replace(`${ALFA}/rastreio.yml`, 'foo.spec.ts#faz algo', 'foo.spec.ts#titulo errado');
    f.replace(`${ALFA}/rastreio.yml`, '[Criar foo]', '[Request fantasma]');
    f.replace(`${ALFA}/rastreio.yml`, 'servico/Foo.java', 'servico/Sumiu.java');
  });
  const all = msgs(run, 'alfa', 'erros', 'G4').join('|');
  assert.match(all, /C2: karma: t.tulo n.o encontrado em foo\.spec\.ts/);
  assert.match(all, /R1: request do Postman inexistente: Request fantasma/);
  assert.match(all, /RN-alfa-001: arquivo de c.digo inexistente: servico\/Sumiu\.java/);
});

test('G5: DIS-NOVA placeholder in the _status.md header', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/_status.md`, 'prefixo: DIS', 'prefixo: DIS-NOVA-ALFA'));
  assert.match(msgs(run, 'alfa', 'erros', 'G5')[0], /`prefixo` ainda usa o placeholder DIS-NOVA-ALFA/);
});

test('G6: module test without a link in the YAML is a warning, not an error', { skip }, () => {
  const run = mut((f) => f.write(TEST_JAVA, 'class FooTest {\n  @Test\n  void deveFazer() {}\n  @Test\n  void orfao() {}\n}\n'));
  assert.equal(run.code, 0);
  assert.match(msgs(run, 'alfa', 'avisos', 'G6')[0], /1 teste\(s\) da funcionalidade sem elo no YAML: FooTest#orfao/);
  assert.equal(find(run, 'alfa').resumo.testesSemElo, 1);
});

test('G7: id listed in descontinuados is used again', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/rastreio.yml`, 'cenarios:', 'descontinuados: [C1]\ncenarios:'));
  assert.match(msgs(run, 'alfa', 'erros', 'G7')[0], /C1: est. em `descontinuados` e voltou a ser usado como entrada/);
});

test('G7: rule with the wrong prefix', { skip }, () => {
  const run = mut((f) => {
    for (const rel of ['rastreio.yml', 'regras.md', 'mapa-camadas.json']) {
      f.write(`${ALFA}/${rel}`, f.read(`${ALFA}/${rel}`).replaceAll('RN-alfa-002', 'RN-zzz-002'));
    }
  });
  assert.match(msgs(run, 'alfa', 'erros', 'G7').join('|'), /RN-zzz-002: o prefixo deveria ser RN-alfa-nnn/);
});

test('G7: rule defined in two features', { skip }, () => {
  const run = mut((f) => f.write('doc/sistema/features/beta/rastreio.yml',
    'cenarios:\n  B1:\n    junit: [FooTest#deveFazer]\n    regras: [RN-alfa-001]\nregras:\n  RN-alfa-001: { codigo: [servico/Foo.java] }\n'));
  assert.match(msgs(run, 'alfa', 'erros', 'G7').join('|'), /RN-alfa-001: tamb.m est. definida em beta\/rastreio\.yml/);
});

test('G8: stale count in the _status.md line is a warning', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/_status.md`, '(2 regras) 3 entradas', '(5 regras) 9 entradas'));
  assert.equal(run.code, 0);
  assert.deepEqual(msgs(run, 'alfa', 'avisos', 'G8'), ['_status.md diz 5 regras, o YAML tem 2', '_status.md diz 9 entradas, o YAML tem 3']);
});

test('G9: map cites a rule that does not exist (error)', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/mapa-camadas.json`, '"RN-alfa-002"', '"RN-alfa-099"'));
  assert.match(msgs(run, 'alfa', 'erros', 'G9')[0], /mapa \(t1\) cita RN-alfa-099 em "Regra dois"/);
});

test('G9: sem_mapa pointing to a map that does not cite the rule (warning)', { skip }, () => {
  const run = mut((f) => f.write('doc/sistema/features/beta/rastreio.yml',
    'sem_mapa: { motivo: sem tela, em: [alfa] }\ncenarios:\n  B1:\n    junit: [FooTest#deveFazer]\n    regras: [RN-beta-001]\nregras:\n  RN-beta-001: { codigo: [servico/Foo.java] }\n'));
  assert.match(msgs(run, 'beta', 'avisos', 'G9')[0], /sem_mapa aponta para alfa, mas o mapa dele n.o cita nenhuma RN-beta-nnn/);
});

test('G9: map group says sem-teste but its rule has proof (warning)', { skip }, () => {
  const run = mut((f) => f.replace(`${ALFA}/mapa-camadas.json`, '"st": "teste-unitario"', '"st": "sem-teste"'));
  assert.match(msgs(run, 'alfa', 'avisos', 'G9')[0], /grupo "\/foo" est. como sem-teste, mas o rastreio tem prova para 001/);
});

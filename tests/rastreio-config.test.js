'use strict';
// Phase 2: per-project configuration (rastreio.config.json) and portability. The pytest-project fixture is a
// different stack, id prefix and layout than saude-dispensacao, and must pass using only configuration plus an adapter.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'tools', 'rastreio', 'cli.mjs');
const SRC = path.join(__dirname, 'fixtures', 'rastreio', 'pytest-project');

function copia() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rastreio-py-'));
  fs.cpSync(SRC, root, { recursive: true });
  return root;
}
const ler = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const gravar = (root, rel, txt) => fs.writeFileSync(path.join(root, rel), txt, 'utf8');
const troca = (root, rel, de, para) => {
  const t = ler(root, rel);
  assert.ok(t.includes(de), `fixture: "${de}" not found in ${rel}`);
  gravar(root, rel, t.replaceAll(de, para));
};

function roda(root, args = [], config = 'rastreio.config.json') {
  const r = spawnSync(process.execPath, [CLI, '--config', path.join(root, config), ...args], { cwd: root, encoding: 'utf8' });
  let results = null;
  if (args.includes('--json')) { try { results = JSON.parse(r.stdout); } catch { /* not JSON */ } }
  return { code: r.status, results, stdout: r.stdout, stderr: r.stderr };
}
function mut(edit, args = ['--json']) {
  const root = copia();
  try { edit(root); return roda(root, args); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const msgs = (run, slug, kind, g) => (run.results.find((x) => x.slug === slug)?.[kind] || []).filter((x) => x.g === g).map((x) => x.m);

test('portability: a Python/pytest project with id prefix BR passes with configuration only', () => {
  const run = mut(() => {});
  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(run.results.map((r) => [r.slug, r.erros.length, r.avisos.length]), [['calc', 0, 0], ['fmt', 0, 0]]);
  assert.deepEqual(run.results[0].resumo, { entradas: 2, regras: 2, semProva: 0, testesSemElo: 0 });
});

test('pytest: test name that does not exist (G4)', () => {
  const run = mut((r) => troca(r, 'docs/features/calc/rastreio.yml', 'test_add_sums_two_numbers', 'test_nope'));
  assert.equal(run.code, 1);
  assert.deepEqual(msgs(run, 'calc', 'erros', 'G4'), ['C1: pytest inexistente: test_calc.py#test_nope']);
});

test('pytest: test file that does not exist (G4)', () => {
  const run = mut((r) => troca(r, 'docs/features/calc/rastreio.yml', 'test_calc.py#', 'test_ghost.py#'));
  assert.match(msgs(run, 'calc', 'erros', 'G4')[0], /C1: pytest arquivo de teste inexistente: test_ghost\.py: test_ghost\.py#test_add_sums_two_numbers/);
});

test('pytest: entry without proof names the stack fields (G1)', () => {
  const run = mut((r) => troca(r, 'docs/features/calc/rastreio.yml', '    pytest: ["test_divide_*"]\n', ''));
  assert.deepEqual(msgs(run, 'calc', 'erros', 'G1'), ['C2: sem prova (pytest, postman ou cobertos_por) e sem lacuna declarada']);
});

test('pytest: orphan test inside fontes_api is a warning (G6)', () => {
  const run = mut((r) => gravar(r, 'tests/test_calc.py', ler(r, 'tests/test_calc.py') + '\n\ndef test_orphan():\n    pass\n'));
  assert.equal(run.code, 0);
  assert.match(msgs(run, 'calc', 'avisos', 'G6')[0], /1 teste\(s\) da funcionalidade sem elo no YAML: test_calc\.py#test_orphan/);
});

test('code file that does not exist is G4 and uses the configured code root', () => {
  const run = mut((r) => troca(r, 'docs/features/fmt/rastreio.yml', 'codigo: [fmt.py]', 'codigo: [sumiu.py]'));
  assert.deepEqual(msgs(run, 'fmt', 'erros', 'G4'), ['BR-fmt-001: arquivo de código inexistente: sumiu.py']);
});

test('id prefix comes from config: a rule with the wrong prefix is G7 and RN-style ids are not special', () => {
  const run = mut((r) => {
    for (const rel of ['rastreio.yml', 'regras.md']) troca(r, `docs/features/fmt/${rel}`, 'BR-fmt-001', 'BR-zzz-001');
    troca(r, 'docs/features/calc/mapa-camadas.json', 'BR-fmt-001', 'BR-zzz-001');
  });
  assert.match(msgs(run, 'fmt', 'erros', 'G7').join('|'), /BR-zzz-001: o prefixo deveria ser BR-fmt-nnn/);
});

test('G8 reads the status line configured in textos.linhaStatus', () => {
  const run = mut((r) => troca(r, 'docs/features/calc/_status.md', '(2 regras) 2 entradas', '(7 regras) 2 entradas'));
  assert.deepEqual(msgs(run, 'calc', 'avisos', 'G8'), ['_status.md diz 7 regras, o YAML tem 2']);
});

// ---------- config validation ----------
function comConfig(editaJson) {
  const root = copia();
  try {
    const j = JSON.parse(ler(root, 'rastreio.config.json'));
    editaJson(j);
    gravar(root, 'rastreio.config.json', JSON.stringify(j));
    return roda(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('config: missing file exits 2 with a clear message', () => {
  const root = copia();
  try {
    const run = roda(root, [], 'nao-existe.json');
    assert.equal(run.code, 2);
    assert.match(run.stderr, /config inexistente/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('config: no --config exits 2', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /informe --config/);
});

test('config: invalid JSON', () => {
  const root = copia();
  try {
    gravar(root, 'rastreio.config.json', '{ nope');
    const run = roda(root);
    assert.equal(run.code, 2);
    assert.match(run.stderr, /config inválido \(JSON\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('config: missing docs.features, unknown stack type and missing stack field are all reported together', () => {
  const run = comConfig((j) => { delete j.docs; j.stacks = [{ tipo: 'cobol' }, { tipo: 'pytest', raizMain: 'src/app' }]; });
  assert.equal(run.code, 2);
  assert.match(run.stderr, /campo ausente: docs\.features/);
  assert.match(run.stderr, /stacks\[0\]: tipo "cobol" desconhecido/);
  assert.match(run.stderr, /stacks\[1\] \(pytest\): campo ausente: raizTest/);
});

test('config: nonexistent paths are reported with the project root', () => {
  const run = comConfig((j) => { j.docs.features = 'docs/outro'; j.stacks[0].raizTest = 'testes'; });
  assert.equal(run.code, 2);
  assert.match(run.stderr, /docs\.features: caminho inexistente: docs\/outro/);
  assert.match(run.stderr, /stacks\[0\]\.raizTest: caminho inexistente: testes/);
});

test('config: empty stacks, bad regex and bad id prefix', () => {
  const run = comConfig((j) => { j.stacks = []; j.ids = { regra: 'R-N', postmanPrefixo: '(' }; });
  assert.equal(run.code, 2);
  assert.match(run.stderr, /stacks: informe ao menos uma stack/);
  assert.match(run.stderr, /ids\.regra: use letras e números/);
  assert.match(run.stderr, /ids\.postmanPrefixo: expressão regular inválida/);
});

test('config: two stacks without prefix are ambiguous for code references', () => {
  const run = comConfig((j) => { j.stacks.push({ tipo: 'karma', raiz: 'src' }); });
  assert.equal(run.code, 2);
  assert.match(run.stderr, /só uma stack pode ficar sem "prefixo"/);
});

test('config: the same config works from any cwd and --root overrides the default root', () => {
  const root = copia();
  try {
    const r = spawnSync(process.execPath, [CLI, '--config', path.join(root, 'rastreio.config.json'), '--root', root, '--json'], { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

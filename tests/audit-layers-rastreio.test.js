'use strict';
// Phase 3: audit-layers-drift reads test groups (testes.grupos), rules without `rn` and G9 from the rastreio gate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { contaTestes, contaRegrasSemRn, g9PorFeature } = require('../tools/lib/audit-layers-rastreio');

const SRC = path.join(__dirname, 'fixtures', 'rastreio', 'pytest-project');
const AUDIT = path.join(__dirname, '..', 'tools', 'audit-layers-drift.js');

function copia() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rastreio-'));
  fs.cpSync(SRC, root, { recursive: true });
  return root;
}

test('contaTestes: counts groups by status and no longer returns zero', () => {
  const mapa = { telas: [{ testes: { grupos: [{ st: 'teste-unitario' }, { st: 'automatizado' }, { st: 'so-bdd' }, { st: 'sem-teste' }, {}] } }] };
  const t = contaTestes(mapa);
  assert.equal(t.total, 5);
  assert.equal(t.comProva, 2);
  assert.equal(t.semProva, 3);
  assert.deepEqual(t.porSt, { 'teste-unitario': 1, automatizado: 1, 'so-bdd': 1, 'sem-teste': 1, 'a-confirmar': 1 });
});

test('contaRegrasSemRn: only rules in force without rn and without sem_rn count', () => {
  const mapa = { telas: [{ regras: [
    { st: 'implementado', rn: ['X-1'] }, { st: 'implementado' }, { st: 'diverge', rn: [] },
    { st: 'implementado', sem_rn: 'architecture' }, { st: 'a-confirmar' }, { st: 'nao-implementado' },
  ] }] };
  assert.deepEqual(contaRegrasSemRn(mapa), { total: 6, semRn: 2 });
});

test('g9PorFeature: clean project has no G9; a map citing a missing rule is a G9 error', () => {
  const root = copia();
  try {
    const cfg = path.join(root, 'rastreio.config.json');
    assert.deepEqual(g9PorFeature(cfg, root).por.calc, []);
    const arq = path.join(root, 'docs/features/calc/mapa-camadas.json');
    fs.writeFileSync(arq, fs.readFileSync(arq, 'utf8').replace('BR-calc-002', 'BR-calc-099'));
    const g9 = g9PorFeature(cfg, root).por.calc;
    assert.ok(g9.some((x) => x.nivel === 'erro' && /BR-calc-099/.test(x.m)), JSON.stringify(g9));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('g9PorFeature: invalid config is reported as erro, not thrown', () => {
  assert.match(g9PorFeature(path.join(os.tmpdir(), 'nao-existe.json')).erro, /config inexistente/);
});

test('audit-layers-drift CLI: prints test groups and G9 when --rastreio-config is given', () => {
  const root = copia();
  try {
    const arq = path.join(root, 'docs/features/calc/mapa-camadas.json');
    fs.writeFileSync(arq, fs.readFileSync(arq, 'utf8').replace('BR-calc-002', 'BR-calc-099'));
    // the auditor looks for <repo>/doc/sistema/features: mirror the fixture layout there
    fs.mkdirSync(path.join(root, 'doc/sistema'), { recursive: true });
    fs.cpSync(path.join(root, 'docs/features'), path.join(root, 'doc/sistema/features'), { recursive: true });
    const r = spawnSync(process.execPath, [AUDIT, '--repo', root, '--feature', 'calc', '--rastreio-config', path.join(root, 'rastreio.config.json'), '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const [calc] = JSON.parse(r.stdout);
    assert.equal(calc.camadas.testes.total, 1);
    assert.equal(calc.camadas.testes.comProva, 1);
    assert.ok(calc.g9.some((x) => x.nivel === 'erro' && /BR-calc-099/.test(x.m)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

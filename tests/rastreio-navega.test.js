'use strict';
// Gate of the links between screens (`navega` in mapa-camadas.json), reported as G9 by tools/rastreio.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildProject, runGate, find, ALFA } = require('./helpers/rastreio-fixture');

const BETA_MAPA = 'doc/sistema/features/beta/mapa-camadas.json';

/** Alfa screen t1 gets `navega`; beta gets a map with screen b1, a valid cross-feature target. */
function run(navega) {
  const root = buildProject((f) => {
    const mapa = JSON.parse(f.read(`${ALFA}/mapa-camadas.json`));
    mapa.telas[0].campos = [{ id: 'proximo' }];
    if (navega) mapa.telas[0].navega = navega;
    f.write(`${ALFA}/mapa-camadas.json`, JSON.stringify(mapa, null, 2));
    f.write(BETA_MAPA, JSON.stringify({ telas: [{ id: 'b1', campos: [] }] }));
  });
  try { return runGate(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const g9 = (r, kind) => (find(r, 'alfa')?.[kind] || []).filter((x) => x.g === 'G9').map((x) => x.m);

test('navega: valid links report nothing (and a map without navega stays as it was)', () => {
  for (const navega of [undefined, [
    { tipo: 'navegacao', campo: 'proximo', para: 'beta-b1', como: 'Próximo leva à beta' },
    { tipo: 'chamada', para: 'alfa-t1', via: 'servico', como: 'Chama a si mesma' },
    { tipo: 'navegacao', para: 'beta-b1', como: 'Redirecionamento sem campo' },
    { campo: 'proximo', para: 'beta-b1', como: 'Sem tipo vale navegacao (primeiro formato)' },
  ]]) {
    const r = run(navega);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual([g9(r, 'erros'), g9(r, 'avisos')], [[], []]);
  }
});

test('navega: target that is not a screen, unknown type and missing como are errors', () => {
  const r = run([
    { tipo: 'navegacao', para: 'beta-b9', como: 'Tela que não existe' },
    { tipo: 'protecao', para: 'beta-b1', como: 'Fora do formato' },
    { tipo: 'navegacao', para: 'beta-b1', como: '  ' },
    { tipo: 'navegacao', como: 'Sem destino' },
  ]);
  assert.equal(r.code, 1);
  assert.deepEqual(g9(r, 'erros'), [
    'mapa (t1) navega[0]: para "beta-b9" não é tela de nenhum mapa-camadas.json (use <slug>-<tela>)',
    'mapa (t1) navega[1]: tipo "protecao" inválido (use navegacao ou chamada)',
    'mapa (t1) navega[2]: sem `como`',
    'mapa (t1) navega[3]: sem `para`',
  ]);
});

test('navega: unknown field and misplaced or missing via are warnings', () => {
  const r = run([
    { tipo: 'navegacao', campo: 'nao-existe', para: 'beta-b1', como: 'x' },
    { tipo: 'navegacao', para: 'beta-b1', via: 'http', como: 'x' },
    { tipo: 'chamada', para: 'beta-b1', como: 'x' },
  ]);
  assert.equal(r.code, 0, 'warnings do not block');
  assert.deepEqual(g9(r, 'avisos'), [
    'mapa (t1) navega[0]: campo "nao-existe" não existe na tela t1',
    'mapa (t1) navega[1]: `via` só vale em chamada',
    'mapa (t1) navega[2]: chamada sem `via` (http ou servico)',
  ]);
});

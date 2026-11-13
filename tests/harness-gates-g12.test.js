'use strict';
// harness-gates slice 3 (ADR-016): G12 derived status, revalidar_em and the panel overlay.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'gates', 'fidelidade', 'cli.mjs');

const PROTO = '<label for="a">Nome</label><input id="a" placeholder="x"><label for="b">Idade</label><input id="b" placeholder="y">';
const CODE_IGUAL = '<busca-typeahead idExterno="a" label="Nome" placeholder="x" /><busca-typeahead idExterno="b" label="Idade" placeholder="y" />';
const CODE_DIFERE = '<busca-typeahead idExterno="a" label="Nome" placeholder="x" /><busca-typeahead idExterno="b" label="Anos" placeholder="y" />';

function repo({ html = CODE_IGUAL, st = {}, extra = {}, severidade = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-g12-'));
  const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), txt); };
  w('proto/proto.json', JSON.stringify({ screens: [{ id: 'tela', file: 'screens/tela.html' }] }));
  w('proto/screens/tela.html', PROTO);
  w('src/x.component.html', html);
  w('harness-gates.json', JSON.stringify({ fidelidade: { features: 'doc/features', prototipos: { demo: 'proto' }, severidade, componentes: { 'busca-typeahead': {} } } }));
  w('doc/features/f1/pareamento.json', JSON.stringify({ schema: 1, telas: [{
    id: 's1', prototipo: { id: 'demo', tela: 'tela' }, codigo: { templates: ['src/x.component.html'] },
    campos: [{ id: 'a', proto: '#a', codigo: 'a' }, { id: 'b', proto: '#b', codigo: 'b' }],
  }] }));
  w('doc/features/f1/mapa-camadas.json', JSON.stringify({ telas: [{ id: 's1', campos: [
    { id: 'a', ui: { t: 'x', st: st.a || 'implementado' } },
    { id: 'b', ui: { t: 'y', st: st.b || 'implementado' } },
    { id: 'c', ui: { t: 'z', st: 'a-confirmar', ...extra } },
  ] }] }));
  return root;
}
const roda = (root, ...x) => spawnSync(process.execPath, [CLI, '--config', path.join(root, 'harness-gates.json'), '--registrar-revisao', '--hoje', '2026-11-12', ...x], { cwd: root, encoding: 'utf8' });
const DADOS = { motivo: 'sem evidência', revalidar_em: '2027-01-01' };

test('CP-S3-01: a typed "implementado" that contradicts G10 is reported with both statuses', () => {
  const r = roda(repo({ html: CODE_DIFERE, extra: DADOS, severidade: { G12: 'erro' } }));
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /ERRO\s+G12\s+s1: b\.ui\.st: o mapa diz "implementado", o G10 deriva "diverge"/);
});

test('CP-S3-02: typed and derived statuses agree, nothing from G12', () => {
  const r = roda(repo({ extra: DADOS, severidade: { G12: 'erro' } }));
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /G12/);
});

test('CP-S3-03: a typed "diverge" that G10 finds equal is reported as stale', () => {
  const r = roda(repo({ st: { a: 'diverge' }, extra: DADOS }));
  assert.match(r.stdout, /aviso\s+G12\s+s1: a\.ui\.st: o mapa diz "diverge", o G10 deriva "implementado"/);
});

test('CP-S3-04: a manual status without motivo and revalidar_em is reported', () => {
  const r = roda(repo());
  assert.match(r.stdout, /c\.ui\.st "a-confirmar" é manual e não tem "motivo"/);
  assert.match(r.stdout, /c\.ui\.st "a-confirmar" é manual e não tem "revalidar_em"/);
});

test('CP-S3-05: an expired revalidar_em is reported, a future one is not', () => {
  assert.match(roda(repo({ extra: { motivo: 'x', revalidar_em: '2026-10-01' } })).stdout, /precisava de revalidação em 2026-10-01/);
  assert.doesNotMatch(roda(repo({ extra: DADOS })).stdout, /G12/);
});

test('CP-S3-06: --derivar writes status-derivado.json and the panel overlay uses it', () => {
  const root = repo({ html: CODE_DIFERE, extra: DADOS });
  roda(root, '--derivar');
  const arq = path.join(root, 'doc', 'features', 'f1', 'status-derivado.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(arq, 'utf8')).telas, { s1: { a: 'implementado', b: 'diverge' } });
  fs.mkdirSync(path.join(root, 'doc', 'sistema'), { recursive: true });
  fs.renameSync(path.join(root, 'doc', 'features'), path.join(root, 'doc', 'sistema', 'features'));
  const { readFeatureScreens } = require('../ui/server/services/project-screens-features.js');
  const campos = readFeatureScreens(root)[0].fields;
  assert.equal(campos.find((c) => c.id === 'b').ui.st, 'div');
  assert.equal(campos.find((c) => c.id === 'a').ui.st, 'ok');
  assert.equal(campos.find((c) => c.id === 'c').ui.st, 'conf'); // manual status is never overridden
});

test('CP-S3-07: a derived status never overrides a manual status such as so-no-prototipo', () => {
  const root = repo({ st: { a: 'so-no-prototipo' }, extra: DADOS });
  roda(root, '--derivar');
  fs.mkdirSync(path.join(root, 'doc', 'sistema'), { recursive: true });
  fs.renameSync(path.join(root, 'doc', 'features'), path.join(root, 'doc', 'sistema', 'features'));
  const { readFeatureScreens } = require('../ui/server/services/project-screens-features.js');
  assert.equal(readFeatureScreens(root)[0].fields.find((c) => c.id === 'a').ui.st, 'proto');
});

test('CP-S3-08: a value confirmed on the screen does not make the field diverge', () => {
  const root = repo({ extra: DADOS });
  const par = path.join(root, 'doc', 'features', 'f1', 'pareamento.json');
  const j = JSON.parse(fs.readFileSync(par, 'utf8'));
  j.telas[0].confirmadas = [{ campo: 'a', atributo: 'rotulo', valor: 'Nome', verificado_em: '2026-11-13' }];
  fs.writeFileSync(par, JSON.stringify(j));
  // the code label of "a" is bound at run time: it is dynamic until a confirmation exists
  const html = path.join(root, 'src', 'x.component.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('label="Nome"', '[label]="rotulo()"'));
  const r = roda(root, '--derivar');
  assert.doesNotMatch(r.stdout, /a\.ui\.st: o mapa diz "implementado", o G10 deriva "diverge"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'doc', 'features', 'f1', 'status-derivado.json'), 'utf8')).telas.s1.a, 'implementado');
});

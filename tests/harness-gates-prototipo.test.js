'use strict';
// harness-gates prototype snapshot (ADR-016): the team gets the prototype inside its repo and can run G10 alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PROTO_CLI = path.join(ROOT, 'tools', 'gates', 'prototipo.mjs');
const PACK = path.join(ROOT, 'tools', 'gates', 'pack.mjs');

function mundo() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-snap-'));
  const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), txt); };
  w('harness/proto/proto.json', JSON.stringify({ version: 7, screens: [{ id: 'tela', file: 'screens/tela.html' }] }));
  w('harness/proto/screens/tela.html', '<label for="a">Nome</label><input id="a">');
  w('harness/proto/assets/grande.png', 'x'.repeat(1000));
  w('harness/cfg.json', JSON.stringify({ fidelidade: { features: 'doc/features', prototipos: { demo: 'C:/fora/do/repo' }, severidade: { G10: 'aviso' }, componentes: { x: { icone: 'y' } } } }));
  w('repo/doc/features/f1/pareamento.json', JSON.stringify({ schema: 1, telas: [{ id: 's1', prototipo: { id: 'demo', tela: 'tela' }, codigo: { templates: ['src/x.html'] }, campos: [{ id: 'a', proto: '#a', codigo: 'a' }] }] }));
  w('repo/src/x.html', '<busca-typeahead idExterno="a" label="Nome" />');
  return { base, repo: path.join(base, 'repo'), proto: path.join(base, 'harness', 'proto'), cfg: path.join(base, 'harness', 'cfg.json'), w };
}
const roda = (...a) => spawnSync(process.execPath, [PROTO_CLI, ...a], { encoding: 'utf8' });

test('CP-S4-01: snapshot copies proto.json and screen HTML only, writes hashes and registers a relative path', () => {
  const m = mundo();
  const r = roda('snapshot', '--repo', m.repo, '--id', 'demo', '--from', m.proto, '--config-from', m.cfg);
  assert.equal(r.status, 0, r.stderr);
  const dest = path.join(m.repo, 'design', 'prototipos', 'demo');
  assert.ok(fs.existsSync(path.join(dest, 'screens', 'tela.html')));
  assert.ok(!fs.existsSync(path.join(dest, 'assets')));
  const marca = JSON.parse(fs.readFileSync(path.join(dest, 'SNAPSHOT.json'), 'utf8'));
  assert.equal(marca.origem_versao, 7);
  assert.deepEqual(Object.keys(marca.arquivos), ['proto.json', 'screens/tela.html']);
  const cfg = JSON.parse(fs.readFileSync(path.join(m.repo, 'harness-gates.json'), 'utf8'));
  assert.equal(cfg.fidelidade.prototipos.demo, 'design/prototipos/demo');
  assert.equal(cfg.fidelidade.componentes.x.icone, 'y');
});

test('CP-S4-02: check is quiet when equal, reports a Harness change and an edited copy', () => {
  const m = mundo();
  roda('snapshot', '--repo', m.repo, '--id', 'demo', '--from', m.proto, '--config-from', m.cfg);
  assert.equal(roda('check', '--repo', m.repo, '--id', 'demo', '--from', m.proto).status, 0);
  m.w('harness/proto/screens/tela.html', '<label for="a">Nome completo</label><input id="a">');
  const novo = roda('check', '--repo', m.repo, '--id', 'demo', '--from', m.proto);
  assert.equal(novo.status, 1);
  assert.match(novo.stderr, /o protótipo mudou desde o snapshot de .*screens\/tela\.html/);
  roda('snapshot', '--repo', m.repo, '--id', 'demo', '--from', m.proto);
  fs.appendFileSync(path.join(m.repo, 'design', 'prototipos', 'demo', 'screens', 'tela.html'), '<p>editado</p>');
  assert.match(roda('check', '--repo', m.repo, '--id', 'demo', '--from', m.proto).stderr, /copia editada/);
});

test('CP-S4-03: the team runs G10 from the repo alone after snapshot and pack', () => {
  const m = mundo();
  roda('snapshot', '--repo', m.repo, '--id', 'demo', '--from', m.proto, '--config-from', m.cfg);
  assert.equal(spawnSync(process.execPath, [PACK, 'pack', '--repo', m.repo], { encoding: 'utf8' }).status, 0);
  fs.rmSync(path.join(m.base, 'harness'), { recursive: true });
  const r = spawnSync(process.execPath, [path.join(m.repo, 'tools', 'harness-gates', 'cli.mjs'), 'fidelidade'], { cwd: m.repo, encoding: 'utf8', env: { ...process.env, HARNESS_DIR: '' } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /\[fidelidade\] ✓ f1 — 1 campos/);
});

test('CP-S4-04: snapshot without a fidelidade block and without --config-from exits 2; bad usage exits 2', () => {
  const m = mundo();
  assert.equal(roda('snapshot', '--repo', m.repo, '--id', 'demo', '--from', m.proto).status, 2);
  assert.equal(roda('snapshot').status, 2);
});

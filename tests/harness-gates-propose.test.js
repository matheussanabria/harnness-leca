'use strict';
// harness-gates `propor` (ADR-016): drafts the prototype x code pairing by matching labels, placeholders and keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'gates', 'fidelidade', 'propose.mjs');
const PACK = path.join(ROOT, 'tools', 'gates', 'pack.mjs');

const PROTO = `
<h3 class="dis-section-title">Dados do Paciente</h3>
<div class="ds-field"><label class="ds-field__label" for="nome">Nome<span class="ds-req">*</span></label><div class="ds-input-wrap"><input id="nome" class="ds-input" placeholder="Nome completo"></div></div>
<div class="ds-field"><label class="ds-field__label" for="tel">Telefone</label><div class="ds-input-wrap"><input id="tel" class="ds-input" placeholder="(00) 00000-0000"></div></div>
<div class="ds-field"><label class="ds-field__label" for="extra">Observação</label><div class="ds-input-wrap"><input id="extra" class="ds-input"></div></div>
<label class="ds-check"><input type="checkbox"> Aceito os termos</label>
<button type="button" class="btn" id="cancelar">Cancelar</button>
<button type="button" class="btn" id="salvar">Salvar</button>
<button type="button" class="btn">Voltar</button>`;

const CODE = `
<h3 class="dis-section-title">Dados do paciente</h3>
<ds-text-field idExterno="nomePaciente" label="Nome" [required]="true" placeholder="Nome completo" formControlName="nome" />
<ds-text-field idExterno="telefone" label="Telefone" placeholder="(00) 00000-0000" formControlName="telefone" />
<ds-text-field idExterno="calculado" [label]="rotuloDinamico()" formControlName="calculado" />
<ds-checkbox label="Aceito os termos" formControlName="termos" />
<button type="button" class="btn">Cancelar</button>
<button type="button" class="btn" id="salvar">Salvar</button>`;

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-propor-'));
  const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), txt); };
  w('proto/proto.json', JSON.stringify({ screens: [{ id: 'tela', file: 'screens/tela.html' }] }));
  w('proto/screens/tela.html', PROTO);
  w('src/x.component.html', CODE);
  w('harness-gates.json', JSON.stringify({ fidelidade: { features: 'doc/features', prototipos: { demo: 'proto' } } }));
  return root;
}
const roda = (root, ...x) => spawnSync(process.execPath, [CLI, '--config', path.join(root, 'harness-gates.json'), '--prototipo', 'demo', '--tela', 'tela', '--templates', 'src/x.component.html', ...x], { cwd: root, encoding: 'utf8' });

test('CP-P1: pairs by label and placeholder, and lists what has no counterpart', () => {
  const r = roda(repo());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[propor\] 6 pares \(alta 6/);
  assert.match(r.stdout, /sem par no protótipo: #extra, texto:Voltar/);
  assert.match(r.stdout, /dinâmicos \(conferir na tela\): calculado/);
});

test('CP-P2: the draft maps the prototype selector to the code key, titles and checkboxes included', () => {
  const root = repo();
  roda(root, '--saida', 'rascunho.json');
  const campos = JSON.parse(fs.readFileSync(path.join(root, 'rascunho.json'), 'utf8')).telas[0].campos;
  const par = (p) => campos.find((c) => c.proto === p)?.codigo;
  assert.equal(par('#nome'), 'nome');
  assert.equal(par('#tel'), 'telefone');
  assert.equal(par('#salvar'), 'salvar');
  assert.equal(par('texto:Cancelar'), undefined); // the prototype button has an id, the code one has not: matched by text below
  assert.equal(par('#cancelar'), 'texto:Cancelar');
  assert.equal(par('texto:Dados do Paciente'), 'titulo:Dados do paciente');
  assert.equal(par('texto:Aceito os termos'), 'termos');
});

test('CP-P3: a button is never paired with a field', () => {
  const root = repo();
  roda(root, '--saida', 'rascunho.json');
  const campos = JSON.parse(fs.readFileSync(path.join(root, 'rascunho.json'), 'utf8')).telas[0].campos;
  for (const c of campos) assert.ok(!(c.proto === '#salvar' && c.codigo !== 'salvar'));
  assert.ok(!campos.some((c) => c.codigo === 'calculado'), 'a dynamic-label field must not be guessed');
});

test('CP-P4: --comparar scores the draft against an existing pairing', () => {
  const root = repo();
  roda(root, '--saida', 'rascunho.json');
  const rasc = JSON.parse(fs.readFileSync(path.join(root, 'rascunho.json'), 'utf8')).telas[0];
  fs.writeFileSync(path.join(root, 'existente.json'), JSON.stringify({ telas: [{ id: 's1', campos: [
    { proto: '#nome', codigo: 'nomePaciente' }, { proto: '#tel', codigo: 'telefone' }, { proto: '#extra', codigo: 'calculado' }, { proto: '#salvar', codigo: 'errado' },
  ] }] }));
  assert.ok(rasc.campos.length > 0);
  const r = roda(root, '--comparar', 'existente.json');
  assert.match(r.stdout, /acertos 2\/4 \(50%\), trocados 1, perdidos 1/);
  assert.match(r.stdout, /trocado: #salvar: proposto salvar, existente errado/);
});

test('CP-P5: the packed CLI runs the propor subcommand with no Harness', () => {
  const root = repo();
  assert.equal(spawnSync(process.execPath, [PACK, 'pack', '--repo', root], { encoding: 'utf8' }).status, 0);
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'harness-gates', 'cli.mjs'), 'propor', '--prototipo', 'demo', '--tela', 'tela', '--templates', 'src/x.component.html'], { cwd: root, encoding: 'utf8', env: { ...process.env, HARNESS_DIR: '' } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /\[propor\] 6 pares/);
});

test('CP-P6: bad usage and a missing template exit 2', () => {
  assert.equal(spawnSync(process.execPath, [CLI], { encoding: 'utf8' }).status, 2);
  const root = repo();
  const r = spawnSync(process.execPath, [CLI, '--config', path.join(root, 'harness-gates.json'), '--prototipo', 'demo', '--tela', 'tela', '--templates', 'src/nao-existe.html'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /template inexistente/);
});

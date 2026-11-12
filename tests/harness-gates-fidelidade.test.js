'use strict';
// harness-gates slice 2 (ADR-016): G10 prototype x code inventory and G11 review by hash, on a synthetic repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'gates', 'fidelidade', 'cli.mjs');
const PACK = path.join(ROOT, 'tools', 'gates', 'pack.mjs');

const PROTO_HTML = `
<div class="ds-field"><label class="ds-field__label" for="emissao">Emissão da receita<span class="ds-req">*</span></label>
  <div class="ds-input-wrap" style="width: 168px"><input id="emissao" class="ds-input" placeholder="dd/mm/aaaa" aria-required="true"><i class="fa-solid fa-calendar-days ds-icon"></i></div></div>
<div class="ds-field"><label class="ds-field__label" for="estab">Estabelecimento</label>
  <div class="ds-field__row"><div class="ds-input-wrap"><input id="estab" class="ds-input" placeholder="Nome ou código CNES"><i class="fa-solid fa-magnifying-glass ds-icon"></i></div></div></div>
<button type="button" class="btn" id="esus"><i class="fa-solid fa-cloud"></i> Buscar no e-SUS</button>
<button type="button" class="btn" id="voltar"><i class="fa-solid fa-chevron-left"></i> Voltar</button>`;

const CODE_HTML = `
<pro-datepicker class="largo" id="dataEmissao" name="dataEmissao" label="Emissão da receita" [required]="true" formControlName="dataEmissao" />
<busca-typeahead idExterno="estabelecimento" label="Estabelecimento" placeholder="Nome ou código CNES" formControlName="estabelecimento" />
@if (mostra()) {
  <button type="button" class="btn"><fa-icon [icon]="iconeSeta" /> Cancelar</button>
}`;

const CODE_TS = 'export class X { readonly iconeSeta = faChevronLeft; }';
const CODE_CSS = '.largo { display: block; width: 168px; }';

function repo({ css = CODE_CSS, declaradas = [], html = CODE_HTML, severidade = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-fid-'));
  const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), txt); };
  w('proto/proto.json', JSON.stringify({ screens: [{ id: 'tela', file: 'screens/tela.html' }] }));
  w('proto/screens/tela.html', PROTO_HTML);
  w('src/x.component.html', html);
  w('src/x.component.ts', CODE_TS);
  w('src/x.component.css', css);
  w('harness-gates.json', JSON.stringify({
    fidelidade: { features: 'doc/features', prototipos: { demo: 'proto' }, severidade, componentes: { 'busca-typeahead': { icone: 'magnifying-glass' }, 'pro-datepicker': { icone: 'calendar', placeholder: 'dd/mm/aaaa' } } },
  }));
  w('doc/features/f1/pareamento.json', JSON.stringify({
    schema: 1,
    telas: [{
      id: 's1',
      prototipo: { id: 'demo', tela: 'tela' },
      codigo: { templates: ['src/x.component.html'] },
      campos: [
        { id: 'emissao', proto: '#emissao', codigo: 'dataEmissao' },
        { id: 'estab', proto: '#estab', codigo: 'estabelecimento' },
        { id: 'esus', proto: '#esus', codigo: 'texto:Buscar no e-SUS' },
        { id: 'voltar', proto: '#voltar', codigo: 'texto:Cancelar' },
      ],
      declaradas,
    }],
  }));
  return root;
}

const roda = (root, ...extra) => spawnSync(process.execPath, [CLI, '--config', path.join(root, 'harness-gates.json'), ...extra], { cwd: root, encoding: 'utf8' });
const DECL_BASE = [
  { campo: 'esus', atributo: 'presenca', lado: 'so-prototipo', motivo: 'sem e-SUS na v2' },
  { campo: 'voltar', atributo: 'rotulo', motivo: 'decisão do PO' },
];

test('CP-01: an undeclared difference fails when G10 is an error and names field, attribute and both values', () => {
  const root = repo({ css: '.largo { width: 100%; }', declaradas: DECL_BASE, severidade: { G10: 'erro' } });
  const r = roda(root, '--registrar-revisao');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /ERRO\s+G10\s+s1: emissao\.largura: protótipo 168 px, código nenhum \(diferença não declarada\)/);
});

test('CP-01b: the same difference is only a warning while G10 is in aviso (default)', () => {
  const root = repo({ css: '.largo { width: 100%; }', declaradas: DECL_BASE });
  const r = roda(root, '--registrar-revisao');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aviso\s+G10\s+s1: emissao\.largura/);
});

test('CP-02: declared differences pass, and the equal width read from CSS raises nothing', () => {
  const root = repo({ declaradas: DECL_BASE, severidade: { G10: 'erro' } });
  const r = roda(root, '--registrar-revisao');
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /G10/);
  assert.match(r.stdout, /4 campos, 2 diferenças declaradas/);
});

test('CP-03: a declaration the code no longer needs is reported as stale', () => {
  const root = repo({
    declaradas: [...DECL_BASE, { campo: 'emissao', atributo: 'largura', motivo: 'campo largo' }],
    severidade: { G10: 'erro' },
  });
  const r = roda(root, '--registrar-revisao');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /emissao\.largura: declarada como diferença, mas o código já coincide com o protótipo/);
});

test('CP-04: a field only in the prototype passes when declared and fails when not', () => {
  const sem = repo({ declaradas: [{ campo: 'voltar', atributo: 'rotulo', motivo: 'x' }], severidade: { G10: 'erro' } });
  const r = roda(sem, '--registrar-revisao');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /esus: só no protótipo \(diferença não declarada\)/);
});

test('CP-04b: an icon is compared by name, resolved from the component .ts', () => {
  const root = repo({ declaradas: DECL_BASE, severidade: { G10: 'erro' } });
  const r = roda(root, '--registrar-revisao');
  assert.doesNotMatch(r.stdout, /voltar\.icone/); // proto fa-chevron-left == code faChevronLeft
});

test('CP-05: G11 warns when a cited file changed after the review and goes quiet after registering again', () => {
  const root = repo({ declaradas: DECL_BASE });
  assert.equal(roda(root, '--registrar-revisao', '--data', '2026-11-01').status, 0);
  assert.doesNotMatch(roda(root).stdout, /G11/);
  fs.appendFileSync(path.join(root, 'src', 'x.component.html'), '\n<span>novo</span>\n');
  const r = roda(root);
  assert.match(r.stdout, /aviso\s+G11\s+src\/x\.component\.html: mudou desde a revisão de 2026-11-01/);
  assert.doesNotMatch(roda(root, '--registrar-revisao').stdout, /G11/);
});

test('CP-05b: G11 does not fire when only the line endings change', () => {
  const root = repo({ declaradas: DECL_BASE });
  roda(root, '--registrar-revisao');
  const f = path.join(root, 'src', 'x.component.html');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.doesNotMatch(roda(root).stdout, /G11/);
});

test('CP-06: a declaration whose expected code value is no longer true fails even as a warning gate', () => {
  const root = repo({ declaradas: [...DECL_BASE.slice(0, 1), { campo: 'voltar', atributo: 'rotulo', codigoValor: 'Sair', motivo: 'x' }] });
  const r = roda(root, '--registrar-revisao');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /voltar\.rotulo: a declaração espera "Sair" no código, mas ele tem "Cancelar"/);
});

test('CP-07: unpaired prototype elements and a broken pairing are reported', () => {
  const root = repo({ declaradas: DECL_BASE });
  const par = path.join(root, 'doc', 'features', 'f1', 'pareamento.json');
  const j = JSON.parse(fs.readFileSync(par, 'utf8'));
  j.telas[0].campos = j.telas[0].campos.filter((c) => c.id !== 'estab');
  j.telas[0].campos.push({ id: 'fantasma', proto: '#nao-existe', codigo: 'naoExiste' });
  fs.writeFileSync(par, JSON.stringify(j));
  const r = roda(root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /elementos do protótipo sem pareamento: estab/);
  assert.match(r.stdout, /fantasma: não encontrado no protótipo/);
});

test('CP-08: the parser keeps ">" inside quoted attributes, marks @if content and drops interpolation from text', async () => {
  const { pathToFileURL } = require('node:url');
  const { parse, textoDe } = await import(pathToFileURL(path.join(ROOT, 'tools', 'gates', 'fidelidade', 'html-parse.mjs')).href);
  const { todos } = parse(`<a [x]="a > b" id="um">Texto {{ nome }} fim</a>
@if (ok(1)) {
  <b id="dois">dentro</b>
} @else {
  <i id="tres">outro</i>
}
<u id="quatro">fora</u>`);
  const por = (id) => todos.find((n) => n.attrs.id === id);
  assert.equal(por('um').attrs['[x]'], 'a > b');
  assert.equal(textoDe(por('um')), 'Texto fim');
  assert.equal(por('dois').cond, true);
  assert.equal(por('tres').cond, true);
  assert.equal(por('quatro').cond, false);
});

test('CP-09: the packed CLI runs the fidelidade subcommand with no Harness', () => {
  const root = repo({ declaradas: DECL_BASE });
  const r1 = spawnSync(process.execPath, [PACK, 'pack', '--repo', root], { encoding: 'utf8', env: { ...process.env, HARNESS_DIR: '' } });
  assert.equal(r1.status, 0, r1.stderr);
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'harness-gates', 'cli.mjs'), 'fidelidade', '--registrar-revisao'], { cwd: root, encoding: 'utf8', env: { ...process.env, HARNESS_DIR: '' } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /\[fidelidade\] ✓ f1 — 4 campos/);
});

test('CP-10: missing fidelidade block or config exits 2', () => {
  const root = repo();
  fs.writeFileSync(path.join(root, 'harness-gates.json'), '{}');
  assert.equal(roda(root).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI], { encoding: 'utf8' }).status, 2);
});

test('CP-11: a prototype field labelled by .ds-info__label (calculation grid) gets its label and required mark', async () => {
  const { pathToFileURL } = require('node:url');
  const { carregaPrototipo } = await import(pathToFileURL(path.join(ROOT, 'tools', 'gates', 'fidelidade', 'adapter-prototipo.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-info-'));
  fs.mkdirSync(path.join(dir, 'screens'));
  fs.writeFileSync(path.join(dir, 'proto.json'), JSON.stringify({ screens: [{ id: 't', file: 'screens/t.html' }] }));
  fs.writeFileSync(path.join(dir, 'screens', 't.html'), '<div><div class="ds-info__label">Tratamento/validade<span class="ds-req">*</span></div><div class="ds-info__value"><div><input id="dias" class="ds-input" style="width: 96px"></div></div></div>');
  const it = carregaPrototipo(dir, 't').item('#dias');
  assert.equal(it.rotulo, 'Tratamento/validade');
  assert.equal(it.obrigatorio, true);
  assert.equal(it.largura, 96);
});

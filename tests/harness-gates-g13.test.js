'use strict';
// harness-gates G13 screen check (ADR-016): the oracle, the comparisons, the roteiro and the in-page probes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const G13 = path.join(__dirname, '..', 'tools', 'gates', 'g13');
const carrega = (nome) => import(pathToFileURL(path.join(G13, nome)).href);

const CAIXA = { sigla: 'comp', singular: 'comprimido', plural: 'comprimidos', embalagemSingular: 'blíster', embalagemPlural: 'blísteres', unidadeCalculo: 'comprimidos', tipo: 'CONTAVEL', calculaPorEmbalagem: true };
const DIPIRONA = { codigo: 1003243, nomeGenerico: 'Dipirona 500mg, comprimido, oral', usoContinuo: true, quantidadeMaximaDispensacao: 240, validadeMaximaDias: 180, intervaloEntreRetiradasDias: 60, unidadeMedida: CAIXA };
const GOTAS = { codigo: 1003250, nomeGenerico: 'Dipirona 500mg/ml, gotas', quantidadeMaximaDispensacao: 1, validadeMaximaDias: 90, intervaloEntreRetiradasDias: 30, unidadeMedida: { sigla: 'mL', singular: 'mL', plural: 'mL', embalagemSingular: 'frasco', embalagemPlural: 'frascos', unidadeCalculo: 'mL', tipo: 'LIQUIDO', calculaPorEmbalagem: true } };

test('CP-G13-01: the registry cells follow the record: units, plural, days and classification order', async () => {
  const { cadastroEsperado } = await carrega('oraculo.mjs');
  assert.deepEqual(cadastroEsperado(DIPIRONA), { 'Disp. máx. mensal': '240 comprimidos', 'Validade máx.': '180 dias', 'Modo de entrega': 'Uso contínuo', 'Intervalo entre retiradas': '60 dias' });
  assert.equal(cadastroEsperado(GOTAS)['Disp. máx. mensal'], '1 mL');
  assert.equal(cadastroEsperado({ ...DIPIRONA, intervaloEntreRetiradasDias: 1 })['Intervalo entre retiradas'], '1 dia');
  assert.equal(cadastroEsperado({ ...DIPIRONA, controlado: true })['Modo de entrega'], 'Controlado');
  assert.equal(cadastroEsperado({ ...DIPIRONA, usoContinuo: false, antimicrobiano: true })['Modo de entrega'], 'Antibiótico');
  const vazio = cadastroEsperado({ codigo: 1, nomeGenerico: 'X', unidade: 'amp' });
  assert.deepEqual([vazio['Disp. máx. mensal'], vazio['Validade máx.'], vazio['Intervalo entre retiradas'], vazio['Modo de entrega']], ['Não informada', 'Não informada', 'Não informado', 'Comum']);
});

test('CP-G13-02: the calculation fields change with the medicamento: packaging, no-calculation mode, long stay, no interval', async () => {
  const { formularioEsperado } = await carrega('oraculo.mjs');
  const comp = formularioEsperado(DIPIRONA);
  assert.deepEqual(comp.presentes, ['Comprimidos por blíster', 'Comprimidos por', 'Comprimidos por dia', 'Tratamento/validade']);
  assert.ok(comp.ausentes.includes('Quantidade prescrita (Mensal)'));
  assert.equal(comp.calculaPrevia, true);
  assert.ok(formularioEsperado(GOTAS).presentes.includes('mL por frasco'));
  const semCalc = formularioEsperado({ ...DIPIRONA, modoSemCalculo: true });
  assert.deepEqual(semCalc.presentes, ['Comprimidos por blíster', 'Unidades por dia (opcional)', 'Quantidade prescrita (Mensal)', 'Tratamento/validade']);
  const longa = formularioEsperado({ ...DIPIRONA, longaPermanencia: true });
  assert.deepEqual(longa.presentes, []);
  assert.ok(longa.ausentes.includes('Tratamento/validade') && longa.avisos.includes('Medicamento de longa permanência'));
  const sem = formularioEsperado({ ...DIPIRONA, intervaloEntreRetiradasDias: undefined });
  assert.equal(sem.calculaPrevia, false);
  assert.deepEqual(sem.avisos, ['não tem intervalo entre retiradas cadastrado']);
  const simples = formularioEsperado({ codigo: 2, nomeGenerico: 'Y', unidade: 'amp', intervaloEntreRetiradasDias: 30 });
  assert.equal(simples.exigeEmbalagem, false);
});

test('CP-G13-03: registry cells are compared strictly and a missing cell is an error', async () => {
  const { conferirCadastro } = await carrega('confere.mjs');
  const esperado = { 'Validade máx.': '180 dias', 'Modo de entrega': 'Uso contínuo', 'Intervalo entre retiradas': '60 dias' };
  assert.deepEqual(conferirCadastro(esperado, [{ rotulo: 'Validade máx.', valor: '180 dias' }, { rotulo: 'Modo de entrega', valor: 'Uso contínuo' }, { rotulo: 'Intervalo entre retiradas', valor: '60 dias' }]), []);
  const r = conferirCadastro(esperado, [{ rotulo: 'Validade máx.', valor: '170 dias' }, { rotulo: 'Modo de entrega', valor: 'Uso continuo' }]);
  assert.equal(r.length, 3);
  assert.match(r[0].m, /"Validade máx\.": a tela mostra "170 dias", o cadastro dá "180 dias"/);
  assert.match(r[1].m, /Uso continuo/);
  assert.match(r[2].m, /"Intervalo entre retiradas" não aparece na tela/);
});

test('CP-G13-04: the dynamic fields: a missing label, an extra label, a missing notice and the preview', async () => {
  const { conferirFormulario } = await carrega('confere.mjs');
  const { formularioEsperado } = await carrega('oraculo.mjs');
  const esp = formularioEsperado(DIPIRONA);
  const ok = { rotulos: ['Comprimidos por blíster', 'Comprimidos por', 'Comprimidos por dia', 'Tratamento/validade', 'Total prescrito'], avisos: [], temPrevia: true };
  assert.deepEqual(conferirFormulario(esp, ok), []);
  const r = conferirFormulario(esp, { rotulos: ['Comprimidos por', 'Quantidade prescrita (Mensal)'], avisos: [], temPrevia: false });
  assert.ok(r.some((a) => /deveria mostrar o campo "Comprimidos por blíster"/.test(a.m)));
  assert.ok(r.some((a) => /mostra o campo "Quantidade prescrita \(Mensal\)", que não se aplica/.test(a.m)));
  assert.ok(r.some((a) => a.nivel === 'aviso' && /prévia de cálculo não apareceu/.test(a.m)));
  const semInt = formularioEsperado({ ...DIPIRONA, intervaloEntreRetiradasDias: 0 });
  const r2 = conferirFormulario(semInt, { rotulos: [], avisos: ['Este medicamento não tem intervalo entre retiradas cadastrado, então não é possível calcular'], temPrevia: false });
  assert.ok(!r2.some((a) => /aviso "não tem intervalo/.test(a.m)));
  assert.ok(conferirFormulario(semInt, { rotulos: [], avisos: [], temPrevia: false }).some((a) => /deveria exibir o aviso/.test(a.m)));
});

test('CP-G13-05: geometry tolerances, skipped items and a missing item', async () => {
  const { conferirGeometria } = await carrega('confere.mjs');
  const a = (id, largura, altura, extra = {}) => ({ id, achou: true, visivel: true, largura, altura, rotulo: null, ...extra });
  const proto = [a('campo', 163, 40), a('botao', 99, 40), a('some', 50, 40), a('so-proto', 80, 40)];
  const codigo = [a('campo', 150, 40), a('botao', 87, 35), a('some', 50, 40)];
  const r = conferirGeometria(proto, codigo, { ignorar: ['so-proto'] });
  assert.equal(r.length, 1);
  assert.match(r[0].m, /^botao: largura 99 x 87 px; altura 40 x 35 px/);
  assert.ok(conferirGeometria(proto, codigo).some((x) => x.nivel === 'erro' && /so-proto: existe no protótipo/.test(x.m)));
  assert.ok(conferirGeometria([a('c', 100, 40, { rotulo: 'Dias' })], [a('c', 100, 40, { rotulo: 'Dia' })]).some((x) => /rótulo "Dias" x "Dia"/.test(x.m)));
});

test('CP-G13-06: the roteiro is validated with clear messages', async () => {
  const { leRoteiro } = await carrega('roteiro.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g13-roteiro-'));
  const grava = (obj) => { const f = path.join(dir, 'r.json'); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const bom = { app: { url: 'http://localhost:8180/' }, caso: { medicamento: 'Dipirona' }, itens: [{ id: 'a', proto: '#a', chave: 'a' }, { id: 'b', proto: '#b', texto: 'Salvar', quando: 'exigeEmbalagem' }] };
  const r = leRoteiro(grava(bom));
  assert.deepEqual(r.viewports, [1024, 768, 375]);
  assert.equal(r.app.api, '/api/medicamentos');
  assert.throws(() => leRoteiro(grava({ ...bom, caso: {} })), /caso\.medicamento ausente/);
  assert.throws(() => leRoteiro(grava({ ...bom, itens: [{ id: 'x', proto: '#x' }] })), /precisa de chave ou texto/);
  assert.throws(() => leRoteiro(grava({ ...bom, itens: [{ id: 'x', proto: '#x', chave: 'x', quando: 'nunca' }] })), /quando "nunca" desconhecido/);
});

test('CP-G13-07: the in-page probes read cells, labels, notices and geometry (needs Chrome, skipped without it)', async (t) => {
  const { carregaChromium, lancaChrome } = await carrega('navegador.mjs');
  const { sondaGeometria, sondaTela } = await carrega('sonda.mjs');
  let chromium;
  try { chromium = await carregaChromium([path.join(__dirname, '..')]); } catch { t.skip('playwright-core não encontrado'); return; }
  let browser;
  try { browser = await lancaChrome(chromium, { headless: true }); } catch { t.skip('Chrome não encontrado'); return; }
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<ds-dispensation-item><div class="dis-item__top"><dl class="ds-info"><div><dt class="ds-info__label">Validade máx.</dt><dd class="ds-info__value">180 dias</dd></div></dl></div>
      <div id="x-calculo"><div class="ds-info"><div><div class="ds-info__label">Comprimidos por blíster<span>*</span></div><div class="ds-info__value"><input id="tamanhoEmbalagem" style="width:120px;height:30px"></div></div></div></div></ds-dispensation-item>
      <ngb-alert>Medicamento de longa permanência</ngb-alert><button class="btn" style="width:90px;height:35px">Cancelar</button>`);
    const tela = await page.evaluate(sondaTela);
    assert.deepEqual(tela.cadastro, [{ rotulo: 'Validade máx.', valor: '180 dias' }]);
    assert.deepEqual(tela.rotulos, ['Comprimidos por blíster']);
    assert.deepEqual(tela.avisos, ['Medicamento de longa permanência']);
    assert.equal(tela.temPrevia, false);
    const g = await page.evaluate(sondaGeometria, { itens: [{ id: 'emb', proto: '#x', chave: 'tamanhoEmbalagem' }, { id: 'cancelar', proto: '#y', texto: 'Cancelar' }, { id: 'nada', proto: '#z', chave: 'nada' }], lado: 'codigo' });
    assert.deepEqual(g[0], { id: 'emb', achou: true, visivel: true, largura: 120, altura: 30, desabilitado: false, rotulo: 'Comprimidos por blíster' });
    assert.equal(g[1].largura, 90);
    assert.equal(g[2].achou, false);
  } finally { await browser.close(); }
});

test('CP-G13-08: the packed copy ships the G13 engine and the tela subcommand runs without the Harness', () => {
  const { spawnSync } = require('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g13-pack-'));
  fs.writeFileSync(path.join(root, 'harness-gates.json'), '{}');
  const PACK = path.join(__dirname, '..', 'tools', 'gates', 'pack.mjs');
  assert.equal(spawnSync(process.execPath, [PACK, 'pack', '--repo', root], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.existsSync(path.join(root, 'tools', 'harness-gates', 'engine', 'g13', 'oraculo.mjs')));
  const cli = path.join(root, 'tools', 'harness-gates', 'cli.mjs');
  const env = { ...process.env, HARNESS_DIR: '' };
  const semRoteiro = spawnSync(process.execPath, [cli, 'tela'], { cwd: root, encoding: 'utf8', env });
  assert.equal(semRoteiro.status, 2);
  assert.match(semRoteiro.stderr, /uso: node cli\.mjs --roteiro/);
  fs.writeFileSync(path.join(root, 'r.json'), JSON.stringify({ app: { url: 'http://localhost:1/' }, caso: {}, itens: [] }));
  const ruim = spawnSync(process.execPath, [cli, 'tela', '--roteiro', 'r.json'], { cwd: root, encoding: 'utf8', env });
  assert.equal(ruim.status, 2);
  assert.match(ruim.stderr, /roteiro inválido/);
});

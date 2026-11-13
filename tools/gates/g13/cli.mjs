#!/usr/bin/env node
// g13/cli: checks the rendered "etapa 2" screen for one medicamento (ADR-016, G13). It needs a running app and Chrome.
//
//   node cli.mjs --roteiro <roteiro.json> --entrar            sign in once; the session is saved outside the repository
//   node cli.mjs --roteiro <roteiro.json> [--medicamento <nome>] [--saida <resultado.json>]
//        [--root <dir>] [--sessao <arquivo>] [--playwright-dir <pasta>]
//
// The person opens the screen (patient, etapa 1, etapa 2); the script picks the medicamento, fills the test values and
// checks three things: the registry cells against the record of the API, the dynamic fields against the rules for that
// medicamento, and the layout against the prototype at each viewport. Exit: 0 ok, 1 errors found, 2 bad usage or setup.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { abre, capturaCadastro, carregaChromium, salvaSessao, sessaoPadrao } from './navegador.mjs';
import { conferirCadastro, conferirFormulario, conferirGeometria } from './confere.mjs';
import { cadastroEsperado, formularioEsperado } from './oraculo.mjs';
import { relatorio } from './relatorio.mjs';
import { leRoteiro } from './roteiro.mjs';
import { medePrototipo, escolheMedicamento } from './passos.mjs';
import { sondaGeometria, sondaTela } from './sonda.mjs';

export async function roda(argv, cwd = process.cwd()) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  if (!opt('--roteiro')) { console.error('uso: node cli.mjs --roteiro <roteiro.json> [--entrar] [--medicamento <nome>] [--saida <arquivo>] [--root <dir>] [--sessao <arquivo>] [--playwright-dir <pasta>]'); return 2; }
  let roteiro;
  try { roteiro = leRoteiro(resolve(cwd, opt('--roteiro'))); } catch (e) { console.error(`[g13] ${e.message}`); return 2; }
  const root = resolve(cwd, opt('--root') || '.');
  const sessao = resolve(cwd, opt('--sessao') || sessaoPadrao(roteiro.sessao || 'dis'));
  let chromium;
  try { chromium = await carregaChromium(opt('--playwright-dir') ? [opt('--playwright-dir')] : []); } catch (e) { console.error(`[g13] ${e.message}`); return 2; }

  if (argv.includes('--entrar')) {
    const { browser, context, page } = await abre(chromium, { headless: false });
    await page.goto(roteiro.app.url);
    console.log('[g13] Entre no sistema na janela aberta. A sessão é salva quando a tela inicial do DIS aparecer (até 10 min)...');
    const origem = new URL(roteiro.app.url).origin;
    await page.waitForFunction((o) => location.origin === o && !!document.querySelector('app-root *'), origem, { timeout: 600000, polling: 1500 });
    await page.waitForTimeout(2500);
    await salvaSessao(context, sessao);
    await browser.close();
    console.log(`[g13] sessão salva em ${sessao} (fora do repositório; não envie esse arquivo a ninguém).`);
    return 0;
  }

  const nome = opt('--medicamento') || roteiro.caso.medicamento;
  const proto = roteiro.prototipo ? await medePrototipo(chromium, resolve(root, roteiro.prototipo.html), roteiro, roteiro.viewports) : null;
  const { browser, context, page } = await abre(chromium, { sessao, headless: false });
  const cadastroApi = capturaCadastro(page, roteiro.app.api);
  await page.goto(roteiro.app.url);
  console.log('[g13] Abra a tela (paciente > Nova prescrição > etapa 2). Se o login for pedido, entre. Aguardando o campo "Medicamento" (até 10 min)...');
  const campo = 'input#medicamento, [idexterno="medicamento"] input, [formcontrolname="medicamento"] input';
  await page.waitForSelector(campo, { timeout: 600000 });
  const dto = await escolheMedicamento(page, campo, nome, cadastroApi);
  if (!dto) { console.error(`[g13] não achei o medicamento "${nome}" na busca (registros capturados: ${cadastroApi.length}).`); await browser.close(); return 2; }
  const esperadoForm = formularioEsperado(dto);
  for (const [chave, valor] of Object.entries(roteiro.caso.valores || {})) {
    const loc = page.locator(`input[formcontrolname="${chave}"], #${chave}, [formcontrolname="${chave}"] input`).first();
    if (await loc.count()) await loc.fill(String(valor));
  }
  if (esperadoForm.calculaPrevia) await page.waitForSelector('#entregaAtual, input[formcontrolname="entregaAtual"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);

  const tela = await page.evaluate(sondaTela);
  const achados = [...conferirCadastro(cadastroEsperado(dto), tela.cadastro), ...conferirFormulario(esperadoForm, tela)];
  const itens = roteiro.itens.map((i) => ({ ...i }));
  const ignorar = roteiro.itens.filter((i) => i.quando && !esperadoForm[i.quando]).map((i) => i.id);
  const medidas = {};
  for (const w of roteiro.viewports) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(700);
    medidas[w] = await page.evaluate(sondaGeometria, { itens, lado: 'codigo' });
    if (proto) for (const a of conferirGeometria(proto[w], medidas[w], { ignorar })) achados.push({ ...a, m: `[${w}px] ${a.m}` });
  }
  await browser.close();
  const resultado = { titulo: roteiro.titulo || null, medicamento: { codigo: dto.codigo, nome: dto.nomeGenerico }, esperado: { cadastro: cadastroEsperado(dto), formulario: esperadoForm }, observado: { tela, geometria: medidas }, prototipo: proto, achados };
  const saida = resolve(cwd, opt('--saida') || join(tmpdir(), `g13-${dto.codigo}.json`));
  writeFileSync(saida, JSON.stringify(resultado, null, 2));
  console.log(relatorio(resultado, saida));
  return achados.some((a) => a.nivel === 'erro') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) roda(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`[g13] ${e.message}`); process.exit(2); });

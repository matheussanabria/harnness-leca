// g13/passos: the interactions of the check (choose the medicamento, measure the prototype). They click and type
// only inside the screen under test, with the test values of the roteiro.
import { pathToFileURL } from 'node:url';
import { lancaChrome } from './navegador.mjs';
import { sondaGeometria } from './sonda.mjs';

const escapa = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Types the name in the lookup, picks the first option that contains it and returns the registry record behind it.
export async function escolheMedicamento(page, seletorCampo, nome, cadastroApi) {
  const campo = page.locator(seletorCampo).first();
  await campo.click();
  await campo.fill(nome);
  await page.waitForSelector('[role=option]', { timeout: 20000 }).catch(() => {});
  const opcao = page.locator('[role=option]', { hasText: new RegExp(escapa(nome), 'i') }).first();
  if (!(await opcao.count())) return null;
  await opcao.click();
  await page.waitForTimeout(500);
  const m = /^\s*(\d+)/.exec(await campo.inputValue());
  const porCodigo = m ? cadastroApi.filter((d) => String(d.codigo) === m[1]).pop() : null;
  return porCodigo || cadastroApi.filter((d) => new RegExp(escapa(nome), 'i').test(d.nomeGenerico || '')).pop() || null;
}

// Renders the exported prototype (one offline HTML) with the default medicamento of the screen and measures it.
export async function medePrototipo(chromium, arquivoHtml, roteiro, viewports) {
  const browser = await lancaChrome(chromium, { headless: true });
  const medidas = {};
  const p = roteiro.prototipo;
  for (const w of viewports) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(`${pathToFileURL(arquivoHtml).href}#${p.tela}`);
    if (p.medicamento) {
      await page.fill('#medicamento', p.medicamento);
      await page.click('#ac-lista [role=option]');
      for (const [id, valor] of Object.entries(p.valores || {})) await page.fill(`#${id}`, String(valor));
      await page.waitForTimeout(400);
    }
    medidas[w] = await page.evaluate(sondaGeometria, { itens: roteiro.itens.map((i) => ({ ...i })), lado: 'proto' });
    await page.close();
  }
  await browser.close();
  return medidas;
}

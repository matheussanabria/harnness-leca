// g13/navegador: the only file that touches a browser. playwright-core is loaded on demand (it is not a dependency of
// the engine) and the installed Chrome is used through its channel, so nothing is downloaded.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Looks for playwright-core in the given folders, then in the usual places of the repository.
export async function carregaChromium(pastas = []) {
  const candidatos = [...pastas, process.cwd(), join(process.cwd(), 'dispensacao-novo', 'dispensacao-web'), dirname(fileURLToPath(import.meta.url))];
  for (const p of candidatos) {
    try {
      const req = createRequire(join(resolve(p), 'x.js'));
      const mod = await import(pathToFileURL(req.resolve('playwright-core')).href);
      return mod.chromium ?? mod.default?.chromium; // a CommonJS package exposes its exports under "default"
    } catch { /* try the next folder */ }
  }
  throw new Error('playwright-core não encontrado. Instale com "npm i -D playwright-core" ou informe --playwright-dir <pasta que contém node_modules>.');
}

// The saved session (cookies) stays outside the repository: it is as sensitive as a password.
export const sessaoPadrao = (nome) => join(homedir(), '.harness-gates', `sessao-${nome}.json`);

// Installed Chrome first (channel), then Edge, then the usual install paths or CHROME_PATH. Nothing is downloaded.
const CAMINHOS = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
export async function lancaChrome(chromium, { headless }) {
  for (const canal of ['chrome', 'msedge']) { try { return await chromium.launch({ channel: canal, headless }); } catch { /* next */ } }
  for (const executablePath of CAMINHOS) { if (existsSync(executablePath)) { try { return await chromium.launch({ executablePath, headless }); } catch { /* next */ } } }
  throw new Error('Chrome não encontrado. Instale o Chrome ou defina CHROME_PATH com o caminho do executável.');
}

export async function abre(chromium, { sessao = null, headless = false, largura = 1280, altura = 900 } = {}) {
  const browser = await lancaChrome(chromium, { headless });
  const context = await browser.newContext({ viewport: { width: largura, height: altura }, ...(sessao && existsSync(sessao) ? { storageState: sessao } : {}) });
  return { browser, context, page: await context.newPage() };
}

export async function salvaSessao(context, arquivo) {
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, JSON.stringify(await context.storageState()));
}

// Remembers every JSON answer of the registry lookup so the record behind the chosen option can be found.
export function capturaCadastro(page, fragmento) {
  const dados = [];
  page.on('response', async (r) => {
    if (!r.url().includes(fragmento) || r.status() !== 200) return;
    try { const j = await r.json(); for (const d of j.dados || []) dados.push(d); } catch { /* not JSON */ }
  });
  return dados;
}

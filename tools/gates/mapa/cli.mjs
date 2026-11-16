#!/usr/bin/env node
// mapa/cli: mapa de arquivos (arquivo → funcionalidade dona → responsabilidade) como gate empacotado (ADR-016).
//
//   node tools/gates/mapa/cli.mjs <find|check|orfaos|build> [args] --config <harness-gates.json> [--root <dir>]
//
//   find <caminho|palavras>   qual entrada do mapa cobre o arquivo ou o tema
//   check [--estrito]         valida frontmatter, tamanho, links mortos, dono único, cobertura e os fontes_* dos _status.md
//   orfaos [--todos]          arquivos fora do mapa, agrupados por pasta (--todos lista um a um)
//   build [--write]           regenera a tabela do mapa (entre os marcadores) e o índice
//
// Config: bloco "mapa" do harness-gates.json (aliases, repos, cobertos, entradas, limiteBytes e, opcional,
// fontesStatus). Exit: 0 ok, 1 problemas no mapa, 2 uso ou config inválidos.
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregaConfig, lerEntradas, listaArquivos, verifica, procura, tabelaIndice, listaCompacta, agrupaPorPasta, comparaFontes } from './lib.mjs';

// O glob e o cabeçalho do _status.md são os do g6 (rastreio/util.mjs): uma implementação só, para o mapa e o g6 nunca
// divergirem sobre o que um glob casa. No pacote o motor mora em engine/rastreio (irmão deste); no Harness, em tools/rastreio.
const { cabecalho, casa } = await import('../rastreio/util.mjs').catch(() => import('../../rastreio/util.mjs'));

const INICIO = '<!-- mapa:indice:inicio -->';
const FIM = '<!-- mapa:indice:fim -->';
const COM_VALOR = new Set(['--config', '--root']);

/** Divergências entre o mapa e os fontes_api/fontes_web dos _status.md (lidos pelos gates de rastreio e pelo doc-gate). */
function divergenciasFontes(root, cfg, entradas, { cobertos, donos }) {
  const fs = cfg.fontesStatus;
  if (!fs) return [];
  const status = entradas.filter((e) => e.chave === 'funcionalidade').flatMap((e) => {
    const p = join(root, fs.status.replace('{slug}', e.esperado));
    if (!existsSync(p)) return [];
    const h = cabecalho(readFileSync(p, 'utf8')) || {};
    return [{ slug: e.esperado, fontes: Object.fromEntries(Object.keys(fs.repos).map((r) => [r, h[`fontes_${r}`] || []])) }];
  });
  const casaDoRepo = (globs, repo, rel) => casa(globs, fs.raizes?.[repo] || [], rel);
  return comparaFontes({ cobertos, donos, entradas, status, repos: fs.repos, casa: casaDoRepo }).map((d) => `fontes_* diverge do mapa: ${d}`);
}

export function roda(argv, cwd = process.cwd()) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const flag = (n) => argv.includes(`--${n}`);
  const posicionais = argv.filter((a, i) => !a.startsWith('--') && !COM_VALOR.has(argv[i - 1]));
  const [cmd, ...args] = posicionais;
  const USO = 'uso: mapa <find <caminho|palavras> | check [--estrito] | orfaos [--todos] | build [--write]> --config <harness-gates.json> [--root <dir>]';
  if (!['find', 'check', 'orfaos', 'build'].includes(cmd)) { console.error(USO); return 2; }
  const arquivoCfg = opt('--config') && resolve(cwd, opt('--config'));
  if (!arquivoCfg || !existsSync(arquivoCfg)) { console.error(`[mapa] config inexistente: ${arquivoCfg || '(informe --config)'}`); return 2; }
  const { cfg, erros } = carregaConfig(arquivoCfg);
  if (erros) { for (const m of erros) console.error(`[mapa] ${m}`); return 2; }
  const root = opt('--root') ? resolve(cwd, opt('--root')) : dirname(arquivoCfg);
  const entradas = lerEntradas(root, cfg);
  const mapaPath = join(root, cfg.arquivo);
  if (!existsSync(mapaPath)) { console.error(`[mapa] ${cfg.arquivo} não existe em ${root}`); return 2; }

  if (cmd === 'find') {
    if (!args.length) { console.error(USO); return 2; }
    const hits = procura(entradas, args.join(' '), cfg, root);
    if (!hits.length) { console.log(`nenhuma entrada do mapa cobre isso; veja a tabela do ${cfg.arquivo}`); return 0; }
    for (const h of hits.slice(0, 5)) console.log(`${h.papel.padEnd(5)} ${h.entrada.arquivo} (${(h.entrada.tamanho / 1024).toFixed(1)} KB): ${h.entrada.meta.resumo}`);
    return 0;
  }
  if (cmd === 'check') {
    const r = verifica(entradas, listaArquivos(root, cfg), cfg, { estrito: flag('estrito'), tamanhoMapa: statSync(mapaPath).size, root });
    (flag('estrito') ? r.erros : r.avisos).push(...divergenciasFontes(root, cfg, entradas, r));
    for (const a of r.avisos) console.log(`aviso: ${a}`);
    for (const e of r.erros) console.error(`erro: ${e}`);
    const pct = r.cobertos.length ? (((r.cobertos.length - r.orfaos.length) / r.cobertos.length) * 100).toFixed(1) : '0';
    console.log(`cobertura: ${r.cobertos.length - r.orfaos.length}/${r.cobertos.length} (${pct}%) em ${entradas.length} entrada(s)`);
    if (r.erros.length) { console.error(`${r.erros.length} problema(s) no mapa`); return 1; }
    console.log('mapa ok');
    return 0;
  }
  if (cmd === 'orfaos') {
    const { orfaos } = verifica(entradas, listaArquivos(root, cfg), cfg, { root });
    if (flag('todos')) orfaos.forEach((f) => console.log(f));
    else for (const [pasta, n] of agrupaPorPasta(orfaos, cfg)) console.log(`${String(n).padStart(4)}  ${pasta}`);
    console.log(`${orfaos.length} arquivo(s) fora do mapa`);
    return 0;
  }
  // build
  const { donos } = verifica(entradas, listaArquivos(root, cfg), cfg, { root });
  const tabela = tabelaIndice(entradas, { donos });
  if (!flag('write')) { console.log(tabela); return 0; }
  const texto = readFileSync(mapaPath, 'utf8');
  const a = texto.indexOf(INICIO);
  const b = texto.indexOf(FIM);
  if (a < 0 || b < a) { console.error(`${cfg.arquivo} precisa dos marcadores ${INICIO} e ${FIM}`); return 2; }
  writeFileSync(mapaPath, `${texto.slice(0, a + INICIO.length)}\n${listaCompacta(entradas, { donos, indice: cfg.indice })}\n${texto.slice(b)}`);
  const indice = join(root, cfg.indice);
  mkdirSync(dirname(indice), { recursive: true });
  const prefixo = '../'.repeat(cfg.indice.split('/').length - 1);
  writeFileSync(indice, `# Índice do mapa\n\nGerado por \`${cfg.comando} build --write\`; não edite à mão.\n\n${tabelaIndice(entradas, { donos, prefixo })}\n`);
  console.log(`tabela do ${cfg.arquivo} e ${cfg.indice} atualizadas`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(roda(process.argv.slice(2)));

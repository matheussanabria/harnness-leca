'use strict';
// harness-gates: mapa de arquivos (arquivo → funcionalidade dona) como gate empacotado (ADR-016).
// Unitários portados de saude-dispensacao/tools/mapa e um teste de ponta a ponta pelo CLI empacotado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { cleanGitEnv, sandboxGit } = require('./helpers/git-sandbox');

const ROOT = path.join(__dirname, '..');
const PACK = path.join(ROOT, 'tools', 'gates', 'pack.mjs');
const lib = () => import(pathToFileURL(path.join(ROOT, 'tools', 'gates', 'mapa', 'lib.mjs')).href);

const cfg = {
  arquivo: 'MAPA.md',
  comando: 'mapa',
  aliases: { api: 'r/api/java', web: 'r/web/app' },
  cobertos: [{ prefixo: 'r/', ext: '\\.(java|ts)$' }],
  limiteBytes: { entrada: 8192, mapa: 6144 },
};
const todos = ['r/api/java/a/A.java', 'r/api/java/a/B.java', 'r/web/app/x/x.ts', 'r/web/app/x/x.spec.ts', 'r/web/app/y.ts'];
const base = 'resumo: r\npalavras: [entregar]\natualizado: 2026-11-12';

function entradaDe({ parseFrontmatter, expandeAlias }, arquivo, chave, esperado, fm, corpo = '') {
  const { meta } = parseFrontmatter(`---\n${fm}\n---\n`);
  const globs = (meta.paths || []).map((g) => ({ original: g, expandido: expandeAlias(g, cfg.aliases) }));
  return { arquivo, tamanho: 100, chave, esperado, meta, corpo, globs };
}

test('alias e glob', async () => {
  const { expandeAlias, casaGlob } = await lib();
  assert.equal(expandeAlias('api:a/A.java', cfg.aliases), 'r/api/java/a/A.java');
  assert.equal(expandeAlias('doc/x.md', cfg.aliases), 'doc/x.md');
  assert.ok(casaGlob('r/web/app/x', 'r/web/app/x/x.spec.ts'));
  assert.ok(casaGlob('r/api/java/**/*.java', 'r/api/java/a/A.java'));
  assert.ok(!casaGlob('r/api/java/*.java', 'r/api/java/a/A.java'));
});

test('mapa válido: sem erro, órfão vira aviso e erro no estrito', async () => {
  const L = await lib();
  const e = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: um\n${base}\npaths: [api:a/A.java, web:x]`, '| `api:a/A.java` | a |\n| `web:x/` | x |\n');
  const r = L.verifica([e], todos, cfg);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.orfaos, ['r/api/java/a/B.java', 'r/web/app/y.ts']);
  assert.equal(L.verifica([e], todos, cfg, { estrito: true }).erros.length, 1);
});

test('glob mais específico vence; empate é erro; glob que perde tudo é aviso', async () => {
  const L = await lib();
  const pasta = entradaDe(L, 'f/base/arquivos.md', 'funcionalidade', 'base', `funcionalidade: base\n${base}\npaths: [api:a, web:x]`);
  const exc = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: um\n${base}\npaths: [api:a/A.java]`);
  const r = L.verifica([pasta, exc], todos, cfg);
  assert.deepEqual(r.erros, []);
  assert.deepEqual([...r.donos.get('r/api/java/a/A.java')], ['f/um/arquivos.md']);
  assert.deepEqual([...r.donos.get('r/api/java/a/B.java')], ['f/base/arquivos.md']);
  const tudo = entradaDe(L, 'f/dois/arquivos.md', 'funcionalidade', 'dois', `funcionalidade: dois\n${base}\npaths: [web:x/x.ts, web:x/x.spec.ts]`);
  assert.ok(L.verifica([pasta, tudo], todos, cfg).avisos.some((x) => x.includes('"web:x" perde todos')));
  const h = L.procura([pasta, exc], 'api:a/A.java', cfg, '/raiz');
  assert.deepEqual(h.map((x) => [x.entrada.arquivo, x.papel]), [['f/um/arquivos.md', 'dono'], ['f/base/arquivos.md', 'cede']]);
});

test('tabela coerente: path sem linha, linha de dono alheia e "Usa" própria', async () => {
  const L = await lib();
  const a = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: um\n${base}\npaths: [api:a/A.java, web:y.ts]`,
    '## API\n| `api:a/A.java` | a |\n| `api:a/B.java` | b |\n## Usa\n| `web:y.ts` | y |\n');
  const b = entradaDe(L, 'f/dois/arquivos.md', 'funcionalidade', 'dois', `funcionalidade: dois\n${base}\npaths: [api:a/B.java]`, '| `api:a/B.java` | b |\n');
  const { avisos } = L.verifica([a, b], todos, cfg);
  assert.ok(avisos.some((x) => x.includes('"web:y.ts" não tem linha')));
  assert.ok(avisos.some((x) => x.includes('tabela de dono cita `api:a/B.java`')));
  assert.ok(avisos.some((x) => x.includes('"Usa" cita `web:y.ts`')));
});

test('dono duplicado, link morto, pasta errada e campo faltando', async () => {
  const L = await lib();
  const a = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: outro\n${base}\npaths: [api:a/A.java, api:nao/existe.java]`);
  const b = entradaDe(L, 'm/infra/t.md', 'area', 'infra', 'area: infra\nresumo: r\natualizado: 2026-11-12\npaths: [api:a/A.java]');
  const { erros } = L.verifica([a, b], todos, cfg);
  assert.ok(erros.some((x) => x.includes('mais de um dono') && x.includes('A.java')));
  assert.ok(erros.some((x) => x.includes('link morto') && x.includes('nao/existe.java')));
  assert.ok(erros.some((x) => x.includes('difere da pasta')));
  assert.ok(erros.some((x) => x.includes('falta o campo "palavras"')));
});

test('fontes_* do _status.md coerentes com o mapa', async () => {
  const L = await lib();
  const um = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: um\n${base}\npaths: [api:a/A.java]`);
  const dois = entradaDe(L, 'f/dois/arquivos.md', 'funcionalidade', 'dois', `funcionalidade: dois\n${base}\npaths: [api:a/B.java]`);
  const { cobertos, donos } = L.verifica([um, dois], todos, cfg);
  const casa = (globs, repo, rel) => globs.some((g) => rel.endsWith(g));
  const repos = { api: 'r/api', web: 'r/web' };
  const ok = [{ slug: 'um', fontes: { api: ['A.java'] } }, { slug: 'dois', fontes: { api: ['B.java'] } }];
  assert.deepEqual(L.comparaFontes({ cobertos, donos, entradas: [um, dois], status: ok, repos, casa }), []);
  const trocado = [{ slug: 'um', fontes: { api: ['A.java', 'B.java'] } }, { slug: 'dois', fontes: {} }];
  const d = L.comparaFontes({ cobertos, donos, entradas: [um, dois], status: trocado, repos, casa });
  assert.equal(d.length, 1);
  assert.ok(d[0].includes('java/a/B.java') && d[0].includes('[um]') && d[0].includes('[dois]'));
});

test('find: dono vence usa; tema por palavra', async () => {
  const L = await lib();
  const dono = entradaDe(L, 'f/um/arquivos.md', 'funcionalidade', 'um', `funcionalidade: um\n${base}\npaths: [api:a/A.java]`);
  const usa = entradaDe(L, 'f/dois/arquivos.md', 'funcionalidade', 'dois', 'funcionalidade: dois\nresumo: r\npalavras: [z]\natualizado: 2026-11-12\npaths: [web:y.ts]', '| `api:a/A.java` | usa |\n');
  const hits = L.procura([usa, dono], 'api:a/A.java', cfg, '/raiz');
  assert.deepEqual(hits.map((h) => [h.entrada.arquivo, h.papel]), [['f/um/arquivos.md', 'dono'], ['f/dois/arquivos.md', 'usa']]);
  assert.equal(L.procura([usa, dono], 'entregar', cfg, '/raiz')[0].entrada.arquivo, 'f/um/arquivos.md');
  assert.equal(L.citadosNoCorpo('| `web:y.ts` | x |', cfg.aliases)[0].expandido, 'r/web/app/y.ts');
});

test('carregaConfig exige o bloco mapa e os campos obrigatórios', async () => {
  const { carregaConfig } = await lib();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-cfg-'));
  const f = path.join(dir, 'harness-gates.json');
  fs.writeFileSync(f, JSON.stringify({ docs: {} }));
  assert.match(carregaConfig(f).erros[0], /falta o bloco "mapa"/);
  fs.writeFileSync(f, JSON.stringify({ mapa: { aliases: {} } }));
  assert.ok(carregaConfig(f).erros.some((m) => m.includes('mapa.repos ausente')));
  fs.writeFileSync(f, '{ inválido');
  assert.match(carregaConfig(f).erros[0], /config inválido/);
});

// ---------- ponta a ponta: o motor empacotado roda sem o Harness ----------

const run = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: cleanGitEnv({ HARNESS_DIR: '' }) });
const git = (cwd, ...a) => sandboxGit(cwd, a);

function projetoSintetico() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-repo-'));
  const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), txt); };
  w('app/src/A.java', 'class A {}\n');
  w('app/src/B.java', 'class B {}\n');
  git(path.join(repo, 'app'), 'init', '-q');
  w('MAPA.md', '# Mapa\n\n<!-- mapa:indice:inicio -->\n<!-- mapa:indice:fim -->\n');
  w('doc/features/um/arquivos.md', '---\nfuncionalidade: um\nresumo: Primeira funcionalidade\npalavras: [um, entregar]\natualizado: 2026-11-13\npaths: [app:A.java, app:B.java]\n---\n\n| Arquivo | Responsabilidade |\n|---|---|\n| `app:A.java` | a |\n| `app:B.java` | b |\n');
  w('doc/features/um/_status.md', '---\nfuncionalidade: um\nfontes_app:\n  - A.java\n  - B.java\n---\n');
  w('harness-gates.json', JSON.stringify({
    mapa: {
      aliases: { app: 'app/src' },
      repos: ['app'],
      cobertos: [{ prefixo: 'app/src/', ext: '\\.java$' }],
      entradas: [{ padrao: 'doc/features/*/arquivos.md', chave: 'funcionalidade' }],
      limiteBytes: { entrada: 8192, mapa: 6144 },
      fontesStatus: { status: 'doc/features/{slug}/_status.md', repos: { app: 'app' }, raizes: { app: ['src/'] } },
    },
  }));
  return repo;
}

test('empacotado: mapa check/find/orfaos/build rodam sem o Harness e o lock continua íntegro', () => {
  const repo = projetoSintetico();
  assert.equal(run([PACK, 'pack', '--repo', repo], ROOT).status, 0);
  const cli = path.join(repo, 'tools', 'harness-gates', 'cli.mjs');
  assert.ok(fs.existsSync(path.join(repo, 'tools', 'harness-gates', 'engine', 'mapa', 'lib.mjs')));

  let r = run([cli, 'mapa', 'check', '--estrito'], repo);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /cobertura: 2\/2 \(100\.0%\)/);
  assert.match(r.stdout, /mapa ok/);

  r = run([cli, 'mapa', 'find', 'app:A.java'], repo);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^dono\s+doc\/features\/um\/arquivos\.md/);

  // arquivo novo sem dono: aviso no check comum, erro no --estrito
  fs.writeFileSync(path.join(repo, 'app', 'src', 'C.java'), 'class C {}\n');
  r = run([cli, 'mapa', 'check'], repo);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aviso: 1 de 3 arquivo\(s\) fora de toda entrada do mapa/);
  r = run([cli, 'mapa', 'check', '--estrito'], repo);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fora de toda entrada do mapa/);
  r = run([cli, 'mapa', 'orfaos', '--todos'], repo);
  assert.match(r.stdout, /app\/src\/C\.java/);
  fs.rmSync(path.join(repo, 'app', 'src', 'C.java'));

  // _status.md com um fonte a menos: o dono pelos fontes_* deixa de bater com o do mapa
  fs.writeFileSync(path.join(repo, 'doc/features/um/_status.md'), '---\nfuncionalidade: um\nfontes_app:\n  - A.java\n---\n');
  r = run([cli, 'mapa', 'check', '--estrito'], repo);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fontes_\* diverge do mapa: app:src\/B\.java/);
  fs.writeFileSync(path.join(repo, 'doc/features/um/_status.md'), '---\nfuncionalidade: um\nfontes_app:\n  - A.java\n  - B.java\n---\n');

  r = run([cli, 'mapa', 'build', '--write'], repo);
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(repo, 'MAPA.md'), 'utf8'), /\*\*Funcionalidades:\*\* \[um\]\(doc\/features\/um\/arquivos\.md\) 2/);
  assert.match(fs.readFileSync(path.join(repo, 'doc', 'mapa', 'INDEX.md'), 'utf8'), /Primeira funcionalidade/);

  // a cópia empacotada segue conferindo com o lock, e o pack check passa
  assert.equal(run([PACK, 'check', '--repo', repo], ROOT).status, 0);
});

test('empacotado: sem bloco mapa a saída é exit 2 com mensagem', () => {
  const repo = projetoSintetico();
  fs.writeFileSync(path.join(repo, 'harness-gates.json'), '{}');
  assert.equal(run([PACK, 'pack', '--repo', repo], ROOT).status, 0);
  const r = run([path.join(repo, 'tools', 'harness-gates', 'cli.mjs'), 'mapa', 'check'], repo);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /falta o bloco "mapa"/);
});

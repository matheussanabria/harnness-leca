'use strict';
// Builds a minimal project tree that the traceability gate (rastreio) can read, so tests can
// break one thing and assert which gate reports it. The runner is swappable: today it copies the
// legacy gate; in phase 1 it will call tools/rastreio with a config file instead.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LEGACY_DIR = process.env.RASTREIO_LEGACY_DIR
  || 'C:/Users/matheuss.rodrigues/git/saude/dispensacao';
const LEGACY_TOOLS = path.join(LEGACY_DIR, 'tools', 'doc-features');
const PKG = 'br/com/procempa/saude/dispensacao';

// RASTREIO_RUNNER=legacy runs the old copy under saude/dispensacao; default runs tools/rastreio.
const RUNNER = process.env.RASTREIO_RUNNER === 'legacy' ? 'legacy' : 'new';
const NEW_CLI = path.join(__dirname, '..', '..', 'tools', 'rastreio', 'cli.mjs');
const CONFIG = path.join(__dirname, '..', 'fixtures', 'rastreio', 'saude-dispensacao.config.json');
const legacyAvailable = () => fs.existsSync(path.join(LEGACY_TOOLS, 'rastreio.mjs'));
// Fixture tests need the legacy gate only when the legacy runner is selected.
const runnerAvailable = () => RUNNER === 'new' || legacyAvailable();

const BASE_FILES = {
  'doc/sistema/features/alfa/rastreio.yml': `cenarios:
  C1:
    junit: [FooTest#deveFazer]
    regras: [RN-alfa-001]
  C2:
    karma: ["foo.spec.ts#faz algo"]
    regras: [RN-alfa-002]
requisitos:
  R1:
    postman: [Criar foo]
    regras: [RN-alfa-001]
regras:
  RN-alfa-001: { codigo: [servico/Foo.java] }
  RN-alfa-002: { codigo: ["web:foo.ts"] }
`,
  'doc/sistema/features/alfa/regras.md': `| id | regra |
|---|---|
| RN-alfa-001 | Regra um |
| RN-alfa-002 | Regra dois |
`,
  'doc/sistema/features/alfa/_status.md': `---
historias: [DIS-1]
prefixo: DIS
fontes_api:
  - servico/**
---
- Rastreabilidade (piloto): (2 regras) 3 entradas
`,
  'doc/sistema/features/alfa/mapa-camadas.json': JSON.stringify({
    telas: [{
      id: 't1',
      regras: [
        { titulo: 'Regra um', st: 'implementado', rn: ['RN-alfa-001'] },
        { titulo: 'Regra dois', st: 'implementado', rn: ['RN-alfa-002'] },
      ],
      testes: { grupos: [{ endpoint: '/foo', st: 'teste-unitario', regras: ['Regra um'] }] },
    }],
  }, null, 2),
  'doc/sistema/features/beta/rastreio.yml': `cenarios:
  B1:
    junit: [FooTest#deveFazer]
`,
  'doc/postman/foo.postman_collection.json': JSON.stringify({
    item: [{ name: 'Foo', item: [{ name: 'DIS-1 | Criar foo' }] }],
  }),
  [`dispensacao-novo/dispensacao-api/src/main/java/${PKG}/servico/Foo.java`]: 'class Foo {}\n',
  [`dispensacao-novo/dispensacao-api/src/test/java/${PKG}/servico/FooTest.java`]:
    'class FooTest {\n  @Test\n  void deveFazer() {}\n}\n',
  'dispensacao-novo/dispensacao-web/src/app/foo.ts': 'export const foo = 1;\n',
  'dispensacao-novo/dispensacao-web/src/app/foo.spec.ts':
    "describe('foo', () => { it('faz algo', () => {}); });\n",
};

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

// Creates a project in a temp dir. `edit` receives helpers to change one file of the base tree.
function buildProject(edit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rastreio-'));
  for (const [rel, content] of Object.entries(BASE_FILES)) write(root, rel, content);
  if (RUNNER === 'legacy') fs.cpSync(LEGACY_TOOLS, path.join(root, 'tools', 'doc-features'), {
    recursive: true,
    filter: (src) => !/[\\/](logs|rascunho-rastreio|_mensagens)([\\/]|$)/.test(src),
  });
  if (edit) {
    edit({
      write: (rel, content) => write(root, rel, content),
      read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8'),
      replace(rel, from, to) {
        const txt = fs.readFileSync(path.join(root, rel), 'utf8');
        if (!txt.includes(from)) throw new Error(`fixture: "${from}" not found in ${rel}`);
        write(root, rel, txt.replace(from, to));
      },
    });
  }
  return root;
}

// Runs the gate on the project and returns { code, results: [{slug, erros, avisos, resumo}] }.
function runGate(root) {
  const args = RUNNER === 'legacy'
    ? [path.join(root, 'tools', 'doc-features', 'rastreio.mjs'), '--json']
    : [NEW_CLI, '--config', CONFIG, '--root', root, '--json'];
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  let results = [];
  try { results = JSON.parse(r.stdout); } catch { /* keep empty; the test shows stderr */ }
  return { code: r.status, results, stderr: r.stderr };
}

const ALFA = 'doc/sistema/features/alfa';
const find = (run, slug) => run.results.find((x) => x.slug === slug);

module.exports = { buildProject, runGate, legacyAvailable, runnerAvailable, find, NEW_CLI, CONFIG, ALFA, PKG, LEGACY_DIR };

'use strict';
// harness-gates slice 1 (ADR-016): pack, sync, check and the packed CLI running without the Harness.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PACK = path.join(ROOT, 'tools', 'gates', 'pack.mjs');
const HARNESS_CLI = path.join(ROOT, 'tools', 'rastreio', 'cli.mjs');
const FIXTURE = path.join(__dirname, 'fixtures', 'rastreio', 'pytest-project');

const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, HARNESS_DIR: '' } });
const pack = (...args) => node([PACK, ...args], ROOT);
const packed = (repo) => path.join(repo, 'tools', 'harness-gates');

function repoCopia() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-repo-'));
  fs.cpSync(FIXTURE, repo, { recursive: true });
  return repo;
}

test('CP-S1-01: pack installs the engine, VERSION and a lock that lists every file', () => {
  const repo = repoCopia();
  const r = pack('pack', '--repo', repo);
  assert.equal(r.status, 0, r.stderr);
  const dir = packed(repo);
  for (const f of ['cli.mjs', 'hash.mjs', 'integridade.mjs', 'VERSION', 'harness-gates.lock', 'engine/rastreio/cli.mjs', 'engine/rastreio/vendor/js-yaml.mjs']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'harness-gates.lock'), 'utf8'));
  assert.equal(lock.versao, fs.readFileSync(path.join(dir, 'VERSION'), 'utf8').trim());
  assert.ok(lock.arquivos['engine/rastreio/gates/g9.mjs']);
  assert.equal(lock.arquivos['harness-gates.lock'], undefined);
});

test('CP-S1-02: the packed CLI runs with no HARNESS_DIR and prints exactly what the Harness CLI prints', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  const viaPacote = node([path.join(packed(repo), 'cli.mjs')], repo);
  const viaHarness = node([HARNESS_CLI, '--config', path.join(repo, 'rastreio.config.json'), '--root', repo], repo);
  assert.equal(viaPacote.status, viaHarness.status, viaPacote.stderr);
  assert.equal(viaPacote.stdout, viaHarness.stdout);
  assert.match(viaPacote.stdout, /\[rastreio\]/);
});

test('CP-S1-03: the packed CLI prefers harness-gates.json over rastreio.config.json', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  fs.writeFileSync(path.join(repo, 'harness-gates.json'), '{ invalid json');
  const r = node([path.join(packed(repo), 'cli.mjs')], repo);
  assert.equal(r.status, 2);
  // rastreio.config.json is valid, so only a bad harness-gates.json can produce this error.
  assert.match(r.stderr, /config inválido/);
});

test('CP-S1-04: the packed CLI reports a missing config with exit 2', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  fs.rmSync(path.join(repo, 'rastreio.config.json'));
  const r = node([path.join(packed(repo), 'cli.mjs')], repo);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /config não encontrada/);
});

test('CP-S1-05: editing a packed file fails the run with exit 3 and names the file', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  const alvo = path.join(packed(repo), 'engine', 'rastreio', 'gates', 'g7.mjs');
  fs.appendFileSync(alvo, '\n// local edit\n');
  const r = node([path.join(packed(repo), 'cli.mjs')], repo);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /alterado\s+engine\/rastreio\/gates\/g7\.mjs/);
});

test('CP-S1-06: a missing and an extra file are both reported', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  fs.rmSync(path.join(packed(repo), 'engine', 'rastreio', 'gates', 'g6.mjs'));
  fs.writeFileSync(path.join(packed(repo), 'intruso.mjs'), 'x');
  const r = node([path.join(packed(repo), 'cli.mjs')], repo);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /ausente\s+engine\/rastreio\/gates\/g6\.mjs/);
  assert.match(r.stderr, /extra\s+intruso\.mjs/);
});

test('CP-S1-07: CRLF line endings do not break the lock', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  const f = path.join(packed(repo), 'engine', 'rastreio', 'gates', 'g7.mjs');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.equal(pack('check', '--repo', repo).status, 0);
});

test('CP-S1-08: sync restores an edited copy and check goes green', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  fs.appendFileSync(path.join(packed(repo), 'engine', 'rastreio', 'gates', 'g7.mjs'), '\n// local edit\n');
  assert.equal(pack('check', '--repo', repo).status, 1);
  assert.equal(pack('sync', '--repo', repo).status, 0);
  assert.equal(pack('check', '--repo', repo).status, 0);
});

test('CP-S1-09: check reports a copy behind the Harness version', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  const lockFile = path.join(packed(repo), 'harness-gates.lock');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.versao = 'gates-000000000000';
  fs.writeFileSync(lockFile, JSON.stringify(lock));
  const r = pack('check', '--repo', repo);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /atrasada/);
});

test('CP-S1-10: pack refuses an existing install, and sync refuses a folder it did not create', () => {
  const repo = repoCopia();
  assert.equal(pack('pack', '--repo', repo).status, 0);
  const de = pack('pack', '--repo', repo);
  assert.equal(de.status, 1);
  assert.match(de.stderr, /sync/);

  const outro = repoCopia();
  fs.mkdirSync(packed(outro), { recursive: true });
  fs.writeFileSync(path.join(packed(outro), 'meu-arquivo.txt'), 'importante');
  const r = pack('sync', '--repo', outro);
  assert.equal(r.status, 1);
  assert.ok(fs.existsSync(path.join(packed(outro), 'meu-arquivo.txt')), 'must not delete a folder without a lock');
});

test('CP-S1-11: --config copies the config only when harness-gates.json does not exist', () => {
  const repo = repoCopia();
  const cfg = path.join(repo, 'rastreio.config.json');
  assert.equal(pack('pack', '--repo', repo, '--config', cfg).status, 0);
  const alvo = path.join(repo, 'harness-gates.json');
  assert.equal(fs.readFileSync(alvo, 'utf8'), fs.readFileSync(cfg, 'utf8'));
  fs.writeFileSync(alvo, '{"mantido":true}');
  assert.equal(pack('sync', '--repo', repo, '--config', cfg).status, 0);
  assert.equal(fs.readFileSync(alvo, 'utf8'), '{"mantido":true}');
});

test('CP-S1-12: bad usage returns exit 2', () => {
  assert.equal(pack('pack').status, 2);
  assert.equal(pack('nope', '--repo', os.tmpdir()).status, 2);
  assert.equal(pack('pack', '--repo', path.join(os.tmpdir(), 'does-not-exist-xyz')).status, 2);
});

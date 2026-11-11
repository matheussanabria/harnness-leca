'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { envLimpo, parseSubject, lerCommits, agregar } = require('../tools/lib/rastreio/historias');

// Fixture repos must never see GIT_DIR/GIT_INDEX_FILE from a running git hook (the pre-commit hook runs this test):
// without this, `git init` and `git commit` below would hit the real repository.
const ENV = envLimpo();

const CLI = path.join(__dirname, '..', 'tools', 'rastreio-historias.js');

function git(dir, ...a) {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=NUL', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, r.stderr);
}
function commit(dir, file, msg) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), `${msg}\n${Math.random()}`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', msg);
}
function repoFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, 'a/One.java', 'DIS-443 Integracao | feat(x): primeira parte');
  commit(dir, 'package-lock.json', 'DIS-443 Integracao | chore(deps): lockfile');
  commit(dir, 'a/Two.java', 'DIS-XXX Nova prescricao | feat(np): tela');
  commit(dir, 'a/Three.java', 'DIS-505 Nova prescricao | feat(np): api');
  commit(dir, 'a/Old.java', 'DIS-396 - Matomo');
  commit(dir, 'a/Misc.java', 'chore: sem chave');
  return dir;
}

test('parseSubject reads current, legacy and placeholder formats', () => {
  assert.deepEqual(parseSubject('DIS-443 Titulo | feat(x): d'), { key: 'DIS-443', title: 'Titulo', desc: 'feat(x): d' });
  assert.equal(parseSubject('DIS-396 - Novo DIS: matomo').title, 'Novo DIS: matomo');
  assert.equal(parseSubject('DIS-XXX T | feat: d').key, 'DIS-XXX');
  assert.equal(parseSubject('chore: nada'), null);
});

test('agregar resolves the placeholder by title, ignores lockfiles and counts commits without a key', () => {
  const dir = repoFixture();
  const { historias, semChave } = agregar({ api: lerCommits(dir) });
  assert.equal(semChave, 1);
  assert.deepEqual(Object.keys(historias).sort(), ['DIS-396', 'DIS-443', 'DIS-505']);
  assert.equal(historias['DIS-505'].commits, 2);
  const arquivos = historias['DIS-443'].repos.api.map((f) => f.path);
  assert.deepEqual(arquivos.sort(), ['a/One.java']);
});

test('the same rewritten commit on two branches counts once, preferring the numeric key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-dup-'));
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, 'seed.txt', 'DIS-505 Nova | feat(a): base');
  git(dir, 'checkout', '-q', '-b', 'b1');
  fs.writeFileSync(path.join(dir, 'x.txt'), 'x');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'DIS-XXX Nova | feat(a): igual');
  git(dir, 'checkout', '-q', 'main');
  fs.writeFileSync(path.join(dir, 'x.txt'), 'x');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'DIS-505 Nova | feat(a): igual');
  const { historias } = agregar({ api: lerCommits(dir) });
  assert.equal(historias['DIS-505'].commits, 2);
  assert.equal(historias['DIS-XXX'], undefined);
});

test('CLI writes JSON for --story and rejects missing --repo', () => {
  const dir = repoFixture();
  const out = path.join(os.tmpdir(), `hist-out-${Date.now()}.json`);
  const ok = spawnSync('node', [CLI, '--repo', `api=${dir}`, '--story', 'DIS-505', '--out', out], { encoding: 'utf8', env: ENV });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(out, 'utf8')).historias), ['DIS-505']);
  const bad = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
});

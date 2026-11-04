'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum-cli-'));
fs.mkdirSync(path.join(root, 'demo'));
const cli = path.join(__dirname, '..', 'tools', 'scrum.js');
const run = (...args) => {
  const r = spawnSync(process.execPath, [cli, ...args, '--project', 'demo'], { env: { ...process.env, HARNESS_PROJECTS_DIR: root }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const AGENT = ['--actor', 'agent:codex:run1'];
const HUMAN = ['--actor', 'human:matheus'];

test('writes require a well-formed actor', () => {
  assert.equal(run('story', 'capture', '--title', 'No actor').code, 1);
  assert.match(run('story', 'capture', '--title', 'Bad', '--actor', 'bot').err, /Actor invalido/);
});

test('agent captures a draft, list shows it, duplicates are flagged', () => {
  const made = JSON.parse(run('story', 'capture', '--title', 'Export report as CSV', ...AGENT).out);
  assert.equal(made.story.maturity, 'draft');
  assert.equal(made.story.sprintId, null);
  const listed = JSON.parse(run('story', 'list', '--maturity', 'draft').out);
  assert.equal(listed.length, 1);
  const again = JSON.parse(run('story', 'capture', '--title', 'Export report as CSV', ...AGENT).out);
  assert.ok(again.candidates.length >= 1);
});

test('agents cannot mark ready or finish; an allowed move records the actor', () => {
  const draft = JSON.parse(run('story', 'list', '--maturity', 'draft').out)[0];
  const id = draft.id;
  assert.equal(draft.laneId, 'pronto-para-dev');
  assert.equal(run('story', 'maturity', id, 'ready', ...AGENT).code, 3);
  assert.equal(run('story', 'move', id, '--to', 'concluido', ...AGENT).code, 3);
  const moved = run('story', 'move', id, '--to', 'em-desenvolvimento', ...AGENT);
  assert.equal(moved.code, 0, moved.err);
  const file = JSON.parse(fs.readFileSync(path.join(root, 'demo', 'scrum.json'), 'utf8'));
  assert.equal(file.transitionHistory.at(-1).actor, 'agent:codex:run1');
  assert.equal(run('story', 'update', id, '--json', '{"status":"x"}', ...HUMAN).code, 1);
});

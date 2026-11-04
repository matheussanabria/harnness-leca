'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFrontmatter, readEpic } = require('../tools/lib/epic-canvas/parse');
const { toMindmap } = require('../tools/lib/epic-canvas/mindmap');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epic-'));
  fs.writeFileSync(path.join(dir, 'README.md'), '---\nid: EP-9\ntitulo: "Demo"\nstatus: em andamento\n---\n# x');
  fs.writeFileSync(path.join(dir, '9.01-a.md'), '---\nid: EP-9.01\ntitulo: First\nstatus: concluida\ndependencias: []\n---\n');
  fs.writeFileSync(path.join(dir, '9.02-b.md'), '---\nid: EP-9.02\ntitulo: Second\nstatus: em-andamento\ndependencias: [EP-9.01]\n---\n');
  return dir;
}

test('parseFrontmatter reads scalars and inline lists, ignores missing block', () => {
  assert.deepEqual(parseFrontmatter('---\na: "x"\nb: [1, 2]\n---'), { a: 'x', b: ['1', '2'] });
  assert.deepEqual(parseFrontmatter('no frontmatter'), {});
});

test('readEpic collects stories sorted with dependencies', () => {
  const epic = readEpic(fixture());
  assert.equal(epic.stories.length, 2);
  assert.deepEqual(epic.stories[1].dependsOn, ['9.01']);
});

test('toMindmap yields a valid single-root tree with status in the text', () => {
  const data = toMindmap(readEpic(fixture()));
  assert.equal(data.schema, 'mindmap@1');
  const root = data.nodes.find((n) => n.id === data.rootId);
  assert.equal(root.children.length, 2);
  assert.match(root.text, /1\/2 done/);
  assert.match(data.nodes.find((n) => n.id === 'story-9.02').text, /^\[in progress\] 9\.02 Second \| after 9\.01$/);
  assert.equal(new Set(data.nodes.map((n) => n.id)).size, data.nodes.length);
});

'use strict';
// Stage gate of done-check: reads the dossier registry (_status.md) and demands done, or skipped with a reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stageItems, hasDossier, parseStages } = require('../tools/lib/scrum-cli/done-check-stages');

const story = { key: 'US-7', id: 'us-7' };
const statusFile = (rows, storyKey = 'US-7') => [
  '---', 'executionId: wf-1', 'workflow: rota-curta', 'feature: demo', `story: ${storyKey}`, 'evidence: declared', '---',
  '# Dossie: demo', '', '| Etapa | Status | Motivo | Arquivo | Em |', '|---|---|---|---|---|', ...rows, '',
].join('\n');
function dossierRoot(rows, storyKey) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  fs.mkdirSync(path.join(root, 'demo'));
  fs.writeFileSync(path.join(root, 'demo', '_status.md'), statusFile(rows, storyKey));
  return root;
}

test('parseStages reads label, id, status, reason and file', () => {
  const rows = parseStages(statusFile(['| Historia (story) | done |  | 01-story.md | 2026-11-11 |', '| Modelagem (modeling) | skipped | Dispensada | 04-modelagem.md | |']));
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.reason]), [['story', 'done', ''], ['modeling', 'skipped', 'Dispensada']]);
});

test('done and skipped-with-reason count; pending, failed and skipped-without-reason stay open', () => {
  const root = dossierRoot([
    '| Historia (story) | done |  | 01-story.md | x |',
    '| Prototipo (prototype) | skipped | Sem elemento visual novo | 03-prototipo.md | x |',
    '| Modelagem (modeling) | skipped |  | 04-modelagem.md | x |',
    '| Revisao (review) | pending |  | 07-code-review.md | |',
    '| Testes (tests) | failed | suite vermelha | 06-testes.md | x |',
  ]);
  const items = stageItems(story, root);
  assert.deepEqual(items.map((i) => i.done), [true, true, false, false, false]);
  assert.match(items[1].note, /Sem elemento visual novo/);
  assert.match(items[2].note, /without a reason/);
});

test('the dossier is found by the story key, not by folder name', () => {
  const root = dossierRoot(['| Historia (story) | done |  | 01-story.md | x |'], 'US-9');
  assert.equal(hasDossier(story, root), false);
  assert.equal(hasDossier({ key: 'us-9' }, root), true);
  assert.deepEqual(stageItems(story, root), []);
  assert.equal(hasDossier(story, path.join(root, 'missing')), false);
});

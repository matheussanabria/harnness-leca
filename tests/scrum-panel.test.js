'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildScrumPanel, MAX_STORIES } = require('../ui/server/services/scrum-panel');

const ORDER = ['backlog', 'em-desenvolvimento', 'em-revisao', 'concluido'];
const lanes = [{ id: 'in_progress', cards: [{ id: '18.07', owner: 'codex', leaseExpired: true, worktree: 'feat/x' }] }];
const story = (id, laneId, extra = {}) => ({ id, key: `K-${id}`, title: `Story ${id}`, laneId, ...extra });

test('joins ledger holder by id or key and the latest commit; hides done stories', () => {
  const panel = buildScrumPanel({
    stories: [story('18.07', 'em-desenvolvimento'), story('x1', 'concluido'), story('x2', 'backlog', { maturity: 'draft' })],
    ledgerLanes: lanes,
    commits: [{ storyIds: ['18.07'], shortSha: 'abc1234', subject: 'newest', committedAt: 't2', verified: true }, { storyIds: ['k-18.07'], shortSha: 'old0000', subject: 'older' }],
    laneOrder: ORDER,
  });
  assert.equal(panel.total, 2);
  const s = panel.items.find((i) => i.id === '18.07');
  assert.equal(s.owner, 'codex');
  assert.equal(s.leaseExpired, true);
  assert.equal(s.commitCount, 2);
  assert.equal(s.lastCommit.subject, 'newest');
  assert.deepEqual(panel.owners, { codex: 1 });
  assert.deepEqual(panel.ledgerActive, [], 'matched ledger cards are not repeated');
  assert.equal(panel.items[0].id, '18.07', 'later lanes first');
  assert.equal(panel.items.find((i) => i.id === 'x2').maturity, 'draft');
});

test('caps the list and flags truncation; works without ledger or commits', () => {
  const stories = Array.from({ length: MAX_STORIES + 5 }, (_, i) => story(`s${i}`, 'backlog'));
  const panel = buildScrumPanel({ stories, ledgerLanes: [], commits: [], laneOrder: ORDER });
  assert.equal(panel.shown, MAX_STORIES);
  assert.equal(panel.truncated, true);
  assert.equal(panel.items[0].owner, null);
  assert.equal(panel.items[0].lastCommit, null);
});

test('client markup escapes titles, uses FontAwesome and no emoji', async () => {
  const { renderScrumPanel } = await import(pathToFileURL(path.join(__dirname, '..', 'ui', 'public', 'js', 'office', 'office-scrum-panel.js')).href);
  const html = renderScrumPanel({ ledger: true, commits: true, truncated: false, owners: { codex: 1 }, items: [{ id: '1', key: 'K1', title: '<img src=x onerror=1>', laneId: 'em-revisao', maturity: 'ready', owner: 'codex', lastCommit: { shortSha: 'abc', subject: 's' }, commitCount: 1 }] });
  assert.ok(!html.includes('<img'));
  assert.match(html, /fa-solid fa-user/);
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
  assert.match(renderScrumPanel({ error: 'boom' }), /boom/);
  assert.match(renderScrumPanel({ ledger: false, commits: false, items: [], owners: {} }), /No open stories/);
});

test('active ledger cards without a Scrum story are listed with their holder', () => {
  const ledgerLanes = [{ id: 'in_progress', cards: [{ id: 'EP-19.03', title: 'Mind map', owner: 'claude', worktree: 'feat/m' }] }, { id: 'done', cards: [{ id: 'EP-00.01', owner: 'codex' }] }];
  const panel = buildScrumPanel({ stories: [story('us-1', 'backlog')], ledgerLanes, commits: [], laneOrder: ORDER });
  assert.equal(panel.ledgerActive.length, 1);
  assert.equal(panel.ledgerActive[0].owner, 'claude');
  assert.deepEqual(panel.owners, { claude: 1 });
});

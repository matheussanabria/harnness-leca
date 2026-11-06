'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const dir = path.join(__dirname, '..', 'ui', 'public', 'js', 'office', 'scrum-board');
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

const lanes = [
  { id: 'backlog', name: 'Backlog', order: 0, visible: true, active: true, icon: 'inbox', color: '#64748b' },
  { id: 'em-desenvolvimento', name: 'Em desenvolvimento', order: 1, visible: true, active: true, icon: 'code', color: '#2563eb' },
  { id: 'concluido', name: 'Concluido', order: 2, visible: true, active: true, icon: 'circle-check', color: '#22c55e' },
  { id: 'oculta', name: 'Oculta', order: 3, visible: false, active: true },
];
const story = (id, laneId, extra = {}) => ({ id, key: id.toUpperCase(), title: `Story ${id}`, laneId, sprintId: 's1', points: 3, ...extra });
const scrum = (over = {}) => ({
  activeSprintId: 's1',
  sprints: [{ id: 's1', name: 'S1', goal: 'Ship', status: 'active', startDate: '2026-11-01', endDate: '2026-11-14' }, { id: 's2', name: 'S2', status: 'planned' }],
  lanes, epics: [{ id: 'e1', title: 'Epic' }],
  stories: [story('a', 'backlog'), story('b', 'em-desenvolvimento'), story('c', 'concluido', { points: 5 }), story('d', 'backlog', { sprintId: null })],
  storyTransitions: { a: { backward: null, forward: 'em-desenvolvimento' }, b: { backward: 'backlog', forward: 'concluido' } },
  ...over,
});

test('model: lanes, views, targets and progress', async () => {
  const m = await load('scrum-board-model.js');
  const s = scrum();
  assert.deepEqual(m.boardLanes(s).map((l) => l.id), ['backlog', 'em-desenvolvimento', 'concluido']);
  assert.equal(m.viewStories(s, 's1').length, 3);
  assert.equal(m.viewStories(s, m.ALL).length, 4);
  assert.equal(m.pickViewId(s, 'nope'), 's1');
  assert.equal(m.pickViewId(s, m.ALL), m.ALL);
  assert.equal(m.canMoveTo(s, s.stories[0], 'em-desenvolvimento'), true);
  assert.equal(m.canMoveTo(s, s.stories[0], 'concluido'), false, 'not adjacent');
  assert.deepEqual(m.sprintProgress(s, 's1'), { stories: 3, doneStories: 1, points: 11, donePoints: 5, percent: 45 });
  assert.equal(m.daysLeft({ endDate: '2026-11-14' }, Date.parse('2026-11-10T12:00:00')), 5);
  assert.equal(m.daysLeft({}), null);
});

test('model: sprint actions mirror the server rules', async () => {
  const m = await load('scrum-board-model.js');
  const s = scrum();
  assert.deepEqual(
    [m.sprintActions(s, s.sprints[0]).canClose, m.sprintActions(s, s.sprints[0]).canStart],
    [true, false],
  );
  const blocked = m.sprintActions(s, s.sprints[1]);
  assert.equal(blocked.canStart, false);
  assert.equal(blocked.blockedBy, 'S1');
  const free = scrum({ sprints: [{ id: 's1', name: 'S1', status: 'closed' }, { id: 's2', name: 'S2', status: 'planned' }] });
  assert.equal(m.sprintActions(free, free.sprints[1]).canStart, true);
  assert.deepEqual(m.closePreview(s, 's1'), { doneStories: 1, donePoints: 5, carriedStories: 2, carriedPoints: 6 });
});

test('views: escaped, FontAwesome only, buttons only toward allowed lanes', async () => {
  const { boardHtml } = await load('scrum-board-view.js');
  const { sprintBarHtml, detailHtml } = await load('scrum-board-sprint-view.js');
  const evil = scrum({ stories: [story('a', 'backlog', { title: '<img src=x onerror=1>', points: 0 })] });
  const board = boardHtml({ scrum: evil, viewId: 's1', selectedId: 'a', busy: false });
  assert.ok(!board.includes('<img'));
  assert.match(board, /0 pts/);
  assert.match(board, /data-move="a" data-to="em-desenvolvimento"/);
  assert.equal((board.match(/data-move=/g) || []).length, 1, 'no button toward a missing lane');
  assert.ok(!board.includes('Oculta'), 'hidden lanes are not drawn');
  const bar = sprintBarHtml({ scrum: scrum(), viewId: 's1', busy: false, confirmClose: false, now: Date.parse('2026-11-10T12:00:00') });
  assert.match(bar, /data-sprint-close-ask/);
  assert.match(bar, /5 dia\(s\) restantes/);
  const confirm = sprintBarHtml({ scrum: scrum(), viewId: 's1', busy: false, confirmClose: true });
  assert.match(confirm, /data-sprint-close="s1"/);
  assert.match(confirm, /<optgroup label="Proxima sprint">/);
  const planned = sprintBarHtml({ scrum: scrum(), viewId: 's2', busy: false, confirmClose: false });
  assert.match(planned, /Encerre "S1"/);
  const detail = detailHtml(scrum(), scrum().stories[0], null, false, false);
  assert.match(detail, /Marcar impedimento/);
  assert.match(detailHtml(scrum(), null, null, false, false), /Selecione uma historia/);
  for (const html of [board, bar, confirm, detail]) assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
});

test('api: wraps routes, sends the office actor, never throws', async () => {
  const { createScrumApi, OFFICE_ACTOR } = await load('scrum-board-api.js');
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push([url, init?.method, init?.body && JSON.parse(init.body)]); return { ok: true, json: async () => ({ scrum: {} }) }; };
  const api = createScrumApi('my proj', fetchImpl);
  await api.move('a', 'backlog', 'em-desenvolvimento');
  await api.closeSprint('s1', { carryOver: 'next', nextSprintId: 's2' });
  assert.equal(calls[0][0], '/api/project/my%20proj/scrum/story/transition');
  assert.deepEqual(calls[0][2], { storyId: 'a', fromLaneId: 'backlog', toLaneId: 'em-desenvolvimento', actor: OFFICE_ACTOR });
  assert.deepEqual(calls[1][2], { actor: OFFICE_ACTOR, carryOver: 'next', nextSprintId: 's2' });
  const failing = createScrumApi('p', async () => ({ ok: false, status: 409, json: async () => ({ error: 'conflito' }) }));
  assert.deepEqual(await failing.load(), { ok: false, status: 409, error: 'conflito' });
  const offline = createScrumApi('p', async () => { throw new Error('down'); });
  assert.equal((await offline.load()).ok, false);
});

function fakeApi(over = {}) {
  const next = (scrumData) => ({ ok: true, data: { scrum: scrumData } });
  return {
    load: async () => next(scrum()),
    move: async () => next(scrum({ stories: scrum().stories.map((s) => (s.id === 'a' ? { ...s, laneId: 'em-desenvolvimento' } : s)) })),
    startSprint: async () => next(scrum()),
    closeSprint: async () => next(scrum()),
    setImpediment: async () => next(scrum()),
    trace: async () => ({ ok: true, data: { maturity: 'ready', dor: { checks: [] }, commits: { available: false } } }),
    ...over,
  };
}

test('controller: load picks the active sprint and remembers the chosen view', async () => {
  const { createBoardController } = await load('scrum-board-controller.js');
  let saved = null;
  const c = createBoardController({ api: fakeApi(), storage: { get: () => null, set: (v) => { saved = v; } } });
  await c.load();
  assert.equal(c.state.viewId, 's1');
  c.selectView('s2');
  assert.deepEqual([c.state.viewId, saved], ['s2', 's2']);
  c.selectView('ghost');
  assert.equal(c.state.viewId, 's1', 'unknown view falls back to the active sprint');
});

test('controller: move publishes the new data, refuses non-adjacent lanes, and shows server errors', async () => {
  const { createBoardController } = await load('scrum-board-controller.js');
  const published = [];
  const c = createBoardController({ api: fakeApi(), publish: (s) => published.push(s) });
  await c.load();
  assert.equal(await c.move('a', 'concluido'), false);
  assert.match(c.state.message.text, /vizinha/);
  assert.equal(await c.move('a', 'em-desenvolvimento'), true);
  assert.equal(published.length, 1);
  assert.equal(c.state.scrum.stories.find((s) => s.id === 'a').laneId, 'em-desenvolvimento');
  const conflict = createBoardController({ api: fakeApi({ move: async () => ({ ok: false, status: 409, error: 'Movida por outra sessao.' }) }), publish: () => assert.fail('no publish on error') });
  await conflict.load();
  assert.equal(await conflict.move('a', 'em-desenvolvimento'), false);
  assert.deepEqual(conflict.state.message, { kind: 'error', text: 'Movida por outra sessao.' });
  assert.equal(conflict.state.scrum.stories.find((s) => s.id === 'a').laneId, 'backlog', 'data untouched on failure');
});

test('controller: close needs a confirmation step and resets it on success; busy blocks double clicks', async () => {
  const { createBoardController } = await load('scrum-board-controller.js');
  let closes = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const c = createBoardController({ api: fakeApi({ closeSprint: async (id, options) => { closes += 1; assert.deepEqual(options, { carryOver: 'next', nextSprintId: 's2' }); await gate; return { ok: true, data: { scrum: scrum() } }; } }) });
  await c.load();
  c.requestClose();
  assert.equal(c.state.confirmClose, true);
  const first = c.closeSprint('s1', 'next', 's2');
  const second = await c.closeSprint('s1', 'next', 's2');
  assert.equal(second, false, 'second call while busy is ignored');
  release();
  assert.equal(await first, true);
  assert.deepEqual([closes, c.state.confirmClose, c.state.message.kind], [1, false, 'ok']);
});

test('controller: selecting a story loads its trace; a late answer for another story is dropped; external data is applied once', async () => {
  const { createBoardController } = await load('scrum-board-controller.js');
  const waiting = {};
  const api = fakeApi({ trace: (id) => new Promise((resolve) => { waiting[id] = () => resolve({ ok: true, data: { maturity: id, dor: {}, commits: {} } }); }) });
  const c = createBoardController({ api });
  await c.load();
  const first = c.selectStory('a');
  const second = c.selectStory('b');
  waiting.b();
  await second;
  waiting.a();
  await first;
  assert.equal(c.state.selectedId, 'b');
  assert.equal(c.state.trace.data.maturity, 'b');
  const fresh = scrum({ stories: [story('x', 'backlog')] });
  c.applyExternal(fresh);
  assert.equal(c.state.scrum, fresh);
  assert.equal(c.state.selectedId, null, 'a story that disappeared is deselected');
  let renders = 0;
  c.subscribe(() => { renders += 1; });
  c.applyExternal(fresh);
  assert.equal(renders, 0, 'the same object is ignored');
});

test('mount: a remount unsubscribes the previous controller so late answers cannot overwrite the board', async () => {
  const { mountScrumBoard } = await load('scrum-board.js');
  const el = { innerHTML: '', querySelector: () => null };
  global.window = { addEventListener() {}, removeEventListener() {} };
  global.sessionStorage = { getItem: () => null, setItem() {} };
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const okJson = (body) => ({ ok: true, json: async () => body });
  const first = mountScrumBoard(el, 'p', { fetchImpl: async () => { await slow; return okJson({ scrum: scrum({ stories: [story('old', 'backlog')] }) }); } });
  await new Promise((resolve) => setImmediate(resolve));
  await mountScrumBoard(el, 'p', { fetchImpl: async () => okJson({ scrum: scrum() }) });
  release();
  await first;
  assert.ok(!el.innerHTML.includes('Story old'), 'stale controller did not repaint');
  assert.ok(el.innerHTML.includes('Story a'));
  delete global.window; delete global.sessionStorage;
});

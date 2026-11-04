'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'ui', 'public', 'js', 'office', 'office-scrum-refresh.js')).href);
const scrum = (name = 'Sprint 2', extra = {}) => ({ activeSprintId: 's', sprints: [{ id: 's', name, goal: '', status: 'active' }], lanes: [], stories: [{ id: 'a', laneId: 'backlog', title: 'A' }], ...extra });
const reply = (body, ok = true) => async () => ({ ok, json: async () => body });
const fakeWin = () => { const events = []; return { events, dispatchEvent: (e) => { events.push(e.type); return true; } }; };
const fakeDoc = (hidden = false) => ({ hidden, addEventListener() {}, removeEventListener() {} });

test('signature ignores noise and changes with sprint name, lane or impediment', async () => {
  const { scrumSignature } = await load();
  assert.equal(scrumSignature(scrum()), scrumSignature({ ...scrum(), updatedAt: 'x' }));
  assert.notEqual(scrumSignature(scrum()), scrumSignature(scrum('Sprint 1')));
  assert.notEqual(scrumSignature(scrum()), scrumSignature(scrum('Sprint 2', { stories: [{ id: 'a', laneId: 'discovery', title: 'A' }] })));
  assert.notEqual(scrumSignature(scrum()), scrumSignature(scrum('Sprint 2', { stories: [{ id: 'a', laneId: 'backlog', title: 'A', impediment: { active: true } }] })));
  assert.equal(scrumSignature(null), '');
});

test('refresh applies changed data once, fires the event, and skips unchanged data', async () => {
  const { startScrumRefresh } = await load();
  const state = { activeProject: 'demo', scrumData: scrum('Sprint 1') };
  const win = fakeWin();
  const h = startScrumRefresh(state, { fetchImpl: reply({ scrum: scrum('Sprint 2') }), doc: fakeDoc(), win, intervalMs: 1e9 });
  assert.equal(await h.refresh(), true);
  assert.equal(state.scrumData.sprints[0].name, 'Sprint 2');
  assert.deepEqual(win.events, ['dai:scrumChanged']);
  assert.equal(await h.refresh(), false, 'same data: no second event');
  assert.equal(win.events.length, 1);
  h.stop();
});

test('hidden tab, failed request, empty payload and a project switch in flight change nothing', async () => {
  const { startScrumRefresh } = await load();
  const win = fakeWin();
  const make = (state, fetchImpl, hidden = false) => startScrumRefresh(state, { fetchImpl, doc: fakeDoc(hidden), win, intervalMs: 1e9 });
  const base = () => ({ activeProject: 'demo', scrumData: scrum('Sprint 1') });
  let h = make(base(), reply({ scrum: scrum('Sprint 2') }), true);
  assert.equal(await h.refresh(), false); h.stop();
  h = make(base(), reply({}, false)); assert.equal(await h.refresh(), false); h.stop();
  h = make(base(), reply({})); assert.equal(await h.refresh(), false); h.stop();
  h = make(base(), async () => { throw new Error('offline'); }); assert.equal(await h.refresh(), false); h.stop();
  const state = base();
  h = make(state, async () => { state.activeProject = 'other'; return { ok: true, json: async () => ({ scrum: scrum('Sprint 9') }) }; });
  assert.equal(await h.refresh(), false);
  assert.equal(state.scrumData.sprints[0].name, 'Sprint 1');
  h.stop();
  assert.deepEqual(win.events, []);
});

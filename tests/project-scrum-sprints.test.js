'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const svc = require('../ui/server/services/project-scrum.service');
const { loadStoredProjectScrum, saveProjectScrum } = require('../ui/server/services/project-scrum-persist');
const { startSprint, closeSprint, summarizeSprint } = require('../ui/server/services/project-scrum-sprints');
const { velocityOf } = require('../ui/server/services/project-scrum-velocity');

const HUMAN = 'human:matheus';

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprints-'));
  const slug = 'demo';
  const data = loadStoredProjectScrum(slug, dir, dir);
  data.stories = [];
  data.sprints = [];
  data.activeSprintId = null;
  saveProjectScrum(slug, dir, data);
  const call = (fn, ...args) => fn(slug, dir, dir, ...args);
  const story = (id, sprintId, points, laneId = 'pronto-para-dev') => {
    call(svc.upsertStory, { id, title: `Story ${id}`, points, sprintId });
    if (laneId !== 'pronto-para-dev') {
      const stored = loadStoredProjectScrum(slug, dir, dir);
      stored.stories.find((s) => s.id === id).laneId = laneId;
      saveProjectScrum(slug, dir, stored);
    }
  };
  const sprint = (id, goal = 'ship it') => call(svc.upsertSprint, { id, name: id, goal });
  const read = () => loadStoredProjectScrum(slug, dir, dir);
  return { call, story, sprint, read, slug, dir };
}

test('upsertSprint merges: selecting a sprint never resets name, goal or dates', () => {
  const p = project();
  p.call(svc.upsertSprint, { id: 's1', name: 'Alpha', goal: 'First goal', startDate: '2026-01-01', endDate: '2026-01-14' });
  p.call(svc.upsertSprint, { id: 's1', makeActive: true });
  const s = p.read().sprints[0];
  assert.deepEqual([s.name, s.goal, s.startDate, s.endDate, s.status], ['Alpha', 'First goal', '2026-01-01', '2026-01-14', 'planned']);
});

test('start needs a goal, a ready story, and refuses a second running sprint', () => {
  const p = project();
  p.sprint('s1', '');
  assert.throws(() => startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN }), /meta/);
  p.sprint('s1');
  assert.throws(() => startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN }), /ao menos uma historia/);
  p.story('a', 's1', 3);
  startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN, now: '2026-02-01T00:00:00.000Z' });
  const s1 = p.read().sprints[0];
  assert.equal(s1.status, 'active');
  assert.deepEqual(s1.commitment.storyIds, ['a']);
  assert.equal(s1.commitment.points, 3);
  p.sprint('s2');
  p.story('b', 's2', 2);
  assert.throws(() => startSprint(p.slug, p.dir, p.dir, 's2', { actor: HUMAN }), /Encerre a sprint ativa/);
  assert.throws(() => startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN }), /so uma sprint planejada/);
});

test('close summarizes, sends unfinished stories to the backlog by default and records history and velocity', () => {
  const p = project();
  p.sprint('s1');
  p.story('done1', 's1', 5, 'concluido');
  p.story('open1', 's1', 3, 'em-desenvolvimento');
  startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN });
  p.story('late', 's1', 2);
  const result = closeSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN, now: '2026-02-15T00:00:00.000Z' });
  const data = p.read();
  const s1 = data.sprints[0];
  assert.equal(s1.status, 'closed');
  assert.deepEqual(
    [s1.summary.committedPoints, s1.summary.completedPoints, s1.summary.carriedPoints, s1.summary.addedAfterStart],
    [8, 5, 5, 1],
  );
  assert.deepEqual(s1.summary.carriedStories.sort(), ['late', 'open1']);
  assert.equal(data.stories.find((s) => s.id === 'open1').sprintId, null);
  assert.equal(data.stories.find((s) => s.id === 'done1').sprintId, 's1');
  assert.deepEqual(data.sprintHistory.map((h) => h.type), ['start', 'close']);
  assert.equal(data.sprintHistory[1].actor, HUMAN);
  assert.equal(result.scrum.summary.velocity.average, 5);
  assert.throws(() => closeSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN }), /nao esta ativa/);
});

test('close can carry unfinished stories to a planned next sprint; bad targets are refused', () => {
  const p = project();
  p.sprint('s1');
  p.sprint('s2');
  p.story('x', 's1', 3, 'em-desenvolvimento');
  startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN });
  assert.throws(() => closeSprint(p.slug, p.dir, p.dir, 's1', { carryOver: 'next', nextSprintId: 'nope' }), /nao encontrada/);
  assert.throws(() => closeSprint(p.slug, p.dir, p.dir, 's1', { carryOver: 'next', nextSprintId: 's1' }), /proxima sprint/);
  assert.throws(() => closeSprint(p.slug, p.dir, p.dir, 's1', { carryOver: 'later' }), /carryOver/);
  closeSprint(p.slug, p.dir, p.dir, 's1', { carryOver: 'next', nextSprintId: 's2', actor: HUMAN });
  assert.equal(p.read().stories.find((s) => s.id === 'x').sprintId, 's2');
});

test('a closed sprint rejects stories and edits; a bad actor is refused', () => {
  const p = project();
  p.sprint('s1');
  p.story('a', 's1', 1, 'concluido');
  startSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN });
  closeSprint(p.slug, p.dir, p.dir, 's1', { actor: HUMAN });
  p.story('b', null, 1);
  assert.throws(() => p.call(svc.assignStorySprint, 'b', 's1'), /encerrada/);
  assert.throws(() => p.call(svc.upsertSprint, { id: 's1', goal: 'changed' }), /encerrada/);
  p.sprint('s3');
  p.story('c', 's3', 1);
  assert.throws(() => startSprint(p.slug, p.dir, p.dir, 's3', { actor: 'root' }), /Actor invalido/);
});

test('pure helpers: summarizeSprint without commitment and velocity average of the last three', () => {
  const s = summarizeSprint({}, [{ id: 'a', laneId: 'concluido', points: 2 }, { id: 'b', laneId: 'backlog', points: 3 }], 't');
  assert.deepEqual([s.committedPoints, s.completedPoints, s.addedAfterStart], [5, 2, 0]);
  const sprints = [1, 2, 3, 6].map((n) => ({ id: `s${n}`, name: `S${n}`, status: 'closed', summary: { committedPoints: 9, completedPoints: n } }));
  assert.equal(velocityOf(sprints).average, 3.7);
  assert.equal(velocityOf([{ status: 'active' }]).average, null);
});

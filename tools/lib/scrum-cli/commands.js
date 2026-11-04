'use strict';
// Story and epic commands. Every function returns plain JSON-able data; nothing prints here.
const svc = require('../../../ui/server/services/project-scrum.service');
const { captureStory } = require('../../../ui/server/services/project-scrum-capture');
const guard = require('./guard');

const UPDATABLE = ['title', 'description', 'acceptanceCriteria', 'epicId', 'points', 'priority', 'assignee'];

const view = (s) => ({ id: s.id, key: s.key, title: s.title, laneId: s.laneId, maturity: s.maturity || 'ready', epicId: s.epicId || null, sprintId: s.sprintId || null, points: s.points ?? null });
const stories = (c) => svc.loadProjectScrum(c.slug, c.projectDir, c.repoRoot).scrum.stories;
const find = (c, id) => {
  const story = stories(c).find((s) => s.id === id || s.key === id);
  if (!story) throw new Error(`Story '${id}' not found.`);
  return story;
};

function list(c, o) {
  return stories(c).filter((s) => (!o.lane || s.laneId === o.lane) && (!o.maturity || (s.maturity || 'ready') === o.maturity) && (!o.epic || s.epicId === o.epic)).map(view);
}

const get = (c, id) => find(c, id);

function capture(c, o) {
  guard.requireActor(o.actor);
  return captureStory(c.slug, c.projectDir, c.repoRoot, { title: o.title, description: o.description, epicId: o.epic, points: o.points ? Number(o.points) : undefined, dedupeKey: o['dedupe-key'] });
}

function update(c, id, o) {
  guard.requireActor(o.actor);
  const patch = JSON.parse(o.json || '{}');
  const extra = Object.keys(patch).filter((k) => !UPDATABLE.includes(k));
  if (extra.length) throw new Error(`Fields not allowed here: ${extra.join(', ')}. Use move, maturity or sprint commands.`);
  const story = find(c, id);
  svc.upsertStory(c.slug, c.projectDir, c.repoRoot, { id: story.id, ...patch });
  return view(find(c, story.id));
}

function move(c, id, o) {
  const actor = guard.requireActor(o.actor);
  guard.assertLane(actor, o.to);
  const story = find(c, id);
  svc.moveStoryToLane(c.slug, c.projectDir, c.repoRoot, story.id, o.from || story.laneId, o.to, undefined, actor);
  return view(find(c, story.id));
}

function maturity(c, id, state, o) {
  const actor = guard.requireActor(o.actor);
  guard.assertMaturity(actor, state);
  const story = find(c, id);
  svc.upsertStory(c.slug, c.projectDir, c.repoRoot, { id: story.id, maturity: state });
  return view(find(c, story.id));
}

function epics(c) {
  return svc.loadProjectScrum(c.slug, c.projectDir, c.repoRoot).scrum.epics || [];
}

module.exports = { list, get, capture, update, move, maturity, epics };

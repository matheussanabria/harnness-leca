'use strict';
// Sprint commands. Agents may create and plan sprints; starting and closing one needs a human actor.
const svc = require('../../../ui/server/services/project-scrum.service');
const { startSprint, closeSprint } = require('../../../ui/server/services/project-scrum-sprints');
const guard = require('./guard');

const load = (c) => svc.loadProjectScrum(c.slug, c.projectDir, c.repoRoot).scrum;
const ids = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

function view(sprint, stories) {
  const mine = stories.filter((story) => story.sprintId === sprint.id);
  const points = (list) => list.reduce((total, story) => total + (Number(story.points) || 0), 0);
  return {
    id: sprint.id, name: sprint.name, goal: sprint.goal, status: sprint.status,
    startDate: sprint.startDate, endDate: sprint.endDate,
    stories: mine.length, points: points(mine), donePoints: points(mine.filter((story) => story.laneId === 'concluido')),
    summary: sprint.summary || null,
  };
}

function list(c) {
  const scrum = load(c);
  return { activeSprintId: scrum.activeSprintId, velocity: scrum.summary.velocity, sprints: scrum.sprints.map((sprint) => view(sprint, scrum.stories)) };
}

function create(c, o) {
  guard.requireActor(o.actor);
  const before = new Set(load(c).sprints.map((sprint) => sprint.id));
  const scrum = svc.upsertSprint(c.slug, c.projectDir, c.repoRoot, { id: o.id, name: o.name, goal: o.goal, startDate: o.start, endDate: o.end }).scrum;
  const made = scrum.sprints.find((sprint) => !before.has(sprint.id)) || scrum.sprints.find((sprint) => sprint.id === o.id);
  return view(made, scrum.stories);
}

function plan(c, sprintId, o) {
  guard.requireActor(o.actor);
  const result = { sprintId, added: [], removed: [] };
  for (const id of ids(o.add)) { svc.assignStorySprint(c.slug, c.projectDir, c.repoRoot, id, sprintId); result.added.push(id); }
  for (const id of ids(o.remove)) { svc.assignStorySprint(c.slug, c.projectDir, c.repoRoot, id, null); result.removed.push(id); }
  const scrum = load(c);
  return { ...result, sprint: view(scrum.sprints.find((sprint) => sprint.id === sprintId), scrum.stories) };
}

function start(c, sprintId, o) {
  const actor = guard.requireHuman(o.actor, 'Starting a sprint');
  const scrum = startSprint(c.slug, c.projectDir, c.repoRoot, sprintId, { actor }).scrum;
  return view(scrum.sprints.find((sprint) => sprint.id === sprintId), scrum.stories);
}

function close(c, sprintId, o) {
  const actor = guard.requireHuman(o.actor, 'Closing a sprint');
  const scrum = closeSprint(c.slug, c.projectDir, c.repoRoot, sprintId, { actor, carryOver: o['carry-over'], nextSprintId: o.next }).scrum;
  return view(scrum.sprints.find((sprint) => sprint.id === sprintId), scrum.stories);
}

module.exports = { list, create, plan, start, close };

'use strict';
// Definition of done for a story. Read-only: reports each item as done or open, never moves the story.
// Criteria come from the story itself; the other items are evidence the caller declares via flags.
const { stageItems, hasDossier } = require('./done-check-stages');
const EVIDENCE = [
  { flag: 'tests', label: 'Automated tests pass' },
  { flag: 'lint', label: 'Lint ran' },
  { flag: 'browser', label: 'UI verified in a real browser' },
  { flag: 'map', label: 'MAPA / docs/mapa updated' },
  { flag: 'commit', label: 'Commit done' },
];

/** pass | done | <sha> => done. na:<reason> => done with a reason. Anything else, or na without a reason => open. */
function judge(value) {
  const v = String(value || '').trim();
  if (!v) return { done: false, note: 'no evidence given' };
  if (/^na:\s*\S/i.test(v)) return { done: true, note: `not applicable: ${v.slice(3).trim()}` };
  if (/^na:?$/i.test(v)) return { done: false, note: 'na needs a reason (na:<reason>)' };
  if (/^(fail|failed|open|no|pending|awaiting.*)$/i.test(v)) return { done: false, note: v };
  return { done: true, note: v };
}

const hasCriteria = (value) => (Array.isArray(value) ? value.length > 0 : String(value || '').trim().length > 0);

/** Stage items from the story's dossier; without a dossier the caller must declare --stages na:<reason>. */
function stagesPart(story, opt, dossierRoot) {
  if (hasDossier(story, dossierRoot)) return stageItems(story, dossierRoot);
  const j = judge(opt.stages);
  return [{ item: 'Delivery stages recorded', done: j.done, note: j.done ? j.note : 'no dossier for this story (run the workflow, or declare --stages na:<reason>)' }];
}

function doneCheck(story, opt, ctx = {}) {
  const items = [{ item: 'Acceptance criteria on the story', ...(hasCriteria(story.acceptanceCriteria) ? { done: true, note: 'present' } : { done: false, note: 'empty (node tools/scrum.js story update)' }) }];
  items.push(...stagesPart(story, opt, ctx.dossierRoot));
  EVIDENCE.forEach((e) => items.push({ item: e.label, ...judge(opt[e.flag]) }));
  const open = items.filter((i) => !i.done);
  return { id: story.id, key: story.key, ready: open.length === 0, open: open.length, items };
}

module.exports = { doneCheck, judge };

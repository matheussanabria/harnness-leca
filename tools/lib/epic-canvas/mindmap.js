'use strict';
// Projects an epic into a mindmap@1 board document: one node per story, status in the text.
const SCHEMA = 'mindmap@1';
const MAX_TEXT = 500;

const STATUS_LABEL = Object.freeze({
  planejada: 'planned', pronta: 'ready', 'em-andamento': 'in progress', 'em-revisao': 'in review',
  concluida: 'done', bloqueada: 'blocked',
});

const label = (status) => STATUS_LABEL[status] || status || 'unknown';
const clip = (text) => text.slice(0, MAX_TEXT);

function storyText(story) {
  const after = story.dependsOn.length ? ` | after ${story.dependsOn.join(', ')}` : '';
  return clip(`[${label(story.status)}] ${story.id} ${story.title}${after}`);
}

function toMindmap(epic) {
  const rootId = `epic-${epic.id}`;
  const done = epic.stories.filter((s) => s.status === 'concluida').length;
  const nodes = [{ id: rootId, text: clip(`${epic.id} ${epic.title} (${done}/${epic.stories.length} done)`), children: epic.stories.map((s) => `story-${s.id}`), collapsed: false }];
  for (const story of epic.stories) nodes.push({ id: `story-${story.id}`, text: storyText(story), children: [], collapsed: false });
  return { schema: SCHEMA, rootId, nodes };
}

module.exports = { toMindmap, storyText, label };

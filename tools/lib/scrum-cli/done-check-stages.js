'use strict';
// Stage gate of the definition of done: reads the dossier registry (_status.md, declared evidence) of a story
// and reports every stage as done or open. A stage counts when it is done, or skipped WITH a reason.
const fs = require('node:fs');
const path = require('node:path');

const ROW = /^\|\s*(.+?)\s*\(([a-z0-9-]+)\)\s*\|\s*([a-z-]+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/i;

/** Frontmatter value of `key` in the head of a _status.md, or "". */
function frontValue(text, key) {
  const m = new RegExp(`^${key}:\\s*(.*)$`, 'mi').exec(text.slice(0, 1200));
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

/** Parses the stage table of a _status.md into { id, label, status, reason, file }. */
function parseStages(text) {
  return text.split(/\r?\n/).map((line) => ROW.exec(line)).filter(Boolean)
    .map((m) => ({ label: m[1], id: m[2], status: m[3].toLowerCase(), reason: m[4].trim(), file: m[5].trim() }));
}

/** Newest _status.md under `dossierRoot` whose frontmatter `story:` is the story key, or null. */
function findDossier(dossierRoot, storyKey) {
  let dirs = [];
  try { dirs = fs.readdirSync(dossierRoot, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return null; }
  const found = dirs.map((d) => path.join(dossierRoot, d.name, '_status.md')).filter((f) => fs.existsSync(f))
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8'), mtime: fs.statSync(file).mtimeMs }))
    .filter((d) => frontValue(d.text, 'story').toLowerCase() === String(storyKey || '').toLowerCase())
    .sort((a, b) => b.mtime - a.mtime);
  return found[0] || null;
}

/** One gate item per stage of the story's dossier. @returns {{item: string, done: boolean, note: string}[]} */
function stageItems(story, dossierRoot) {
  const dossier = dossierRoot ? findDossier(dossierRoot, story.key) : null;
  if (!dossier) return [];
  const stages = parseStages(dossier.text);
  if (!stages.length) return [{ item: 'Delivery stages registered', done: false, note: 'dossier has no stage table' }];
  return stages.map((s) => {
    if (s.status === 'done') return { item: `Stage ${s.label} (${s.id})`, done: true, note: 'done' };
    if (s.status === 'skipped' && s.reason) return { item: `Stage ${s.label} (${s.id})`, done: true, note: `skipped: ${s.reason}` };
    if (s.status === 'skipped') return { item: `Stage ${s.label} (${s.id})`, done: false, note: 'skipped without a reason' };
    return { item: `Stage ${s.label} (${s.id})`, done: false, note: s.status };
  });
}

/** True when a dossier of the story exists under `dossierRoot`. */
const hasDossier = (story, dossierRoot) => Boolean(dossierRoot && findDossier(dossierRoot, story.key));

module.exports = { stageItems, hasDossier, parseStages, findDossier };

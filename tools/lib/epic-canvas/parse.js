'use strict';
// Reads an epic folder (README.md + NN.NN-slug.md stories) into plain objects. Read-only.
const fs = require('node:fs');
const path = require('node:path');

const STORY_FILE = /^\d+\.\d+-.+\.md$/;

function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return value.replace(/^["']|["']$/g, '');
}

/** Top-level `key: value` pairs of the YAML frontmatter; nested or multi-line values are ignored. */
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (pair && pair[2] !== '') out[pair[1]] = parseScalar(pair[2]);
  }
  return out;
}

function readDoc(file) {
  return parseFrontmatter(fs.readFileSync(file, 'utf8'));
}

function asList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/** @returns {{id:string,title:string,status:string,stories:object[]}} */
function readEpic(epicDir) {
  const readme = readDoc(path.join(epicDir, 'README.md'));
  const stories = fs.readdirSync(epicDir).filter((name) => STORY_FILE.test(name)).sort().map((name) => {
    const meta = readDoc(path.join(epicDir, name));
    const id = String(meta.id || name.split('-')[0]).replace(/^EP-/, '');
    return {
      id,
      title: String(meta.titulo || meta.title || name),
      status: String(meta.status || 'planejada'),
      priority: String(meta.prioridade || ''),
      dependsOn: asList(meta.dependencias).map((dep) => String(dep).replace(/^EP-/, '')),
      file: name,
    };
  });
  return { id: String(readme.id || path.basename(epicDir)), title: String(readme.titulo || ''), status: String(readme.status || ''), stories };
}

module.exports = { parseFrontmatter, readEpic };

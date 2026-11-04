#!/usr/bin/env node
'use strict';
// node tools/epic-canvas.js <epic-dir> [--out file.json] [--push http://localhost:PORT --project <slug>]
const fs = require('node:fs');
const { readEpic } = require('./lib/epic-canvas/parse');
const { toMindmap } = require('./lib/epic-canvas/mindmap');
const { pushBoard } = require('./lib/epic-canvas/push');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dir = process.argv[2];
  if (!dir || dir.startsWith('--')) {
    console.error('usage: node tools/epic-canvas.js <epic-dir> [--out file] [--push <base-url> --project <slug>]');
    process.exit(2);
  }
  const epic = readEpic(dir);
  const data = toMindmap(epic);
  const out = arg('out');
  if (out) fs.writeFileSync(out, JSON.stringify(data, null, 2));
  const base = arg('push');
  if (base) {
    const project = arg('project');
    if (!project) throw new Error('--project is required with --push');
    console.log(JSON.stringify(await pushBoard({ base, project, title: `Epic ${epic.id}`, data })));
  } else if (!out) {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });

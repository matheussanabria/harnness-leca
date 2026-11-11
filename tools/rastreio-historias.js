#!/usr/bin/env node
'use strict';
// CLI: node tools/rastreio-historias.js --repo api=<dir> --repo web=<dir> [--prefix DIS] [--out file.json] [--story DIS-443]
// Read-only on the repositories. Without --out the JSON goes to stdout.
const fs = require('node:fs');
const path = require('node:path');
const { lerCommits, agregar } = require('./lib/rastreio/historias');

function args(argv) {
  const o = { repos: {}, prefix: 'DIS' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--repo') {
      const [nome, dir] = String(argv[++i] || '').split('=');
      if (!nome || !dir) throw new Error('--repo expects name=dir');
      o.repos[nome] = dir;
    } else if (a === '--prefix') o.prefix = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--story') o.story = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!Object.keys(o.repos).length) throw new Error('at least one --repo name=dir is required');
  return o;
}

function main() {
  const o = args(process.argv.slice(2));
  const porRepo = {};
  for (const [nome, dir] of Object.entries(o.repos)) {
    porRepo[nome] = lerCommits(path.resolve(dir));
  }
  const { historias, semChave } = agregar(porRepo, o.prefix);
  const saida = {
    geradoEm: new Date().toISOString(),
    repos: Object.keys(o.repos),
    semChave,
    historias: o.story ? { [o.story]: historias[o.story] } : historias,
  };
  const json = `${JSON.stringify(saida, null, 2)}\n`;
  if (o.out) fs.writeFileSync(o.out, json, 'utf8');
  else process.stdout.write(json);
  const n = Object.keys(historias).length;
  process.stderr.write(`${n} stories, ${semChave} commits without key\n`);
}

try { main(); } catch (e) { process.stderr.write(`error: ${e.message}\n`); process.exit(1); }

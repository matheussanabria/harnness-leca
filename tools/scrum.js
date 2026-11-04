#!/usr/bin/env node
'use strict';
// Scrum CRUD for agents and scripts. JSON on stdout, errors on stderr. Exit: 0 ok, 1 error, 2 usage, 3 needs human.
//   node tools/scrum.js story list|get|capture|update|move|maturity ... [--project slug] [--actor human:x|agent:engine:run]
//   node tools/scrum.js epic list
const { resolveContext } = require('./lib/scrum-cli/context');
const cmd = require('./lib/scrum-cli/commands');
const { GuardError } = require('./lib/scrum-cli/guard');

function parse(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) { opt[argv[i].slice(2)] = argv[i + 1]; i += 1; } else pos.push(argv[i]);
  }
  return { pos, opt };
}

function run(pos, opt) {
  const [group, action, a, b] = pos;
  const c = resolveContext(opt.project);
  if (group === 'epic' && action === 'list') return cmd.epics(c);
  if (group !== 'story') return undefined;
  const table = {
    list: () => cmd.list(c, opt),
    get: () => cmd.get(c, a),
    capture: () => cmd.capture(c, opt),
    update: () => cmd.update(c, a, opt),
    move: () => cmd.move(c, a, opt),
    maturity: () => cmd.maturity(c, a, b, opt),
  };
  return table[action] ? table[action]() : undefined;
}

try {
  const { pos, opt } = parse(process.argv.slice(2));
  const result = run(pos, opt);
  if (result === undefined) { console.error('usage: node tools/scrum.js story list|get|capture|update|move|maturity | epic list'); process.exit(2); }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err.message);
  process.exit(err instanceof GuardError ? 3 : 1);
}

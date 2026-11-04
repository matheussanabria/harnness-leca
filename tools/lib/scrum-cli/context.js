'use strict';
// Resolves project slug, folder and code repo for the Scrum CLI, with the same sources the server uses.
const fs = require('node:fs');
const path = require('node:path');
const { getProjects } = require('../../../ui/server/config');
const { getProjectRepoInfo } = require('../../../ui/server/controllers/inspect.controller');

function activeSlug() {
  const file = path.join(getProjects(), '.active');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || '';
}

function resolveContext(slugArg) {
  const slug = slugArg || activeSlug();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) throw new Error('Project slug missing or invalid (use --project).');
  const projectDir = path.join(getProjects(), slug);
  if (!fs.existsSync(projectDir)) throw new Error(`Project '${slug}' not found.`);
  const { repo } = getProjectRepoInfo(slug);
  return { slug, projectDir, repoRoot: repo || projectDir };
}

module.exports = { resolveContext };

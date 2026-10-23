#!/usr/bin/env node
// Adopts an existing project folder into the harness: detects its stack, creates projects/<slug> from the
// template, seeds instructions.md and memory.md with what was found on disk, and links the folder name so that
// conversations from every engine are routed to the project.
//
// Usage:
//   node tools/adopt-project.js --path <folder> [--slug <slug>] [--dry-run]
//                               [--activate]   write the slug to projects/.active
//                               [--sync]       then run `node tools/sync.js --project <slug>`
//
// Existing instructions.md / memory.md are never overwritten. Nothing is written outside projects/.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { ROOT } = require("./lib/root");
const { slugify } = require("./lib/text");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { detectStack } = require("./lib/adopt/detect-stack");
const { renderInstructions, renderMemory } = require("./lib/adopt/render");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/;

function resolveSource(raw) {
  if (!raw) throw new CliError("Usage: node tools/adopt-project.js --path <folder> [--slug <slug>] [--dry-run] [--activate] [--sync]");
  const abs = path.resolve(raw);
  let st;
  try { st = fs.statSync(abs); } catch { throw new CliError(`Folder not found: ${abs}`); }
  if (!st.isDirectory()) throw new CliError(`Not a folder: ${abs}`);
  const projectsDir = path.join(ROOT, "projects") + path.sep;
  if ((abs + path.sep).startsWith(projectsDir)) throw new CliError("The source folder cannot be inside the harness projects/ directory.");
  return abs;
}

function resolveSlug(requested, source) {
  const slug = requested || slugify(path.basename(source));
  if (slug === "_template" || !SLUG_RE.test(slug)) throw new CliError(`Invalid slug "${slug}". Use lowercase letters, digits, "-" or "_" (max 60).`);
  return slug;
}

/** Adds the source folder name as an alias when it differs from the slug. Returns true when the file changed. */
function addAlias(slug, folderName, dry) {
  if (folderName.toLowerCase() === slug) return false;
  const file = path.join(ROOT, "projects", ".sources.json");
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); } catch { /* missing or invalid: start empty */ }
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
  const current = Array.isArray(data[slug]) ? data[slug] : [];
  if (current.some((a) => String(a).toLowerCase() === folderName.toLowerCase())) return false;
  data[slug] = [...current, folderName];
  if (!dry) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
    fs.renameSync(tmp, file);
  }
  return true;
}

function writeIfMissing(file, content, dry, io) {
  const name = path.relative(ROOT, file).split(path.sep).join("/");
  if (fs.existsSync(file)) { io.log(`  kept     ${name} (already exists)`); return; }
  io.log(`  ${dry ? "would write" : "wrote   "} ${name}`);
  if (!dry) fs.writeFileSync(file, content);
}

/** Core of the command; returns what was done so tests can assert on it. */
function run(argv, io = console) {
  const dry = flag("dry-run", argv);
  const source = resolveSource(opt("path", argv));
  const slug = resolveSlug(opt("slug", argv), source);
  const stack = detectStack(source);
  const dir = path.join(ROOT, "projects", slug);
  const existed = fs.existsSync(dir);
  const date = new Date().toISOString().slice(0, 10);

  io.log(`Adopting ${source} as "${slug}"${dry ? " (dry run)" : ""}`);
  io.log(`  stack    ${[...stack.languages, ...stack.frameworks].join(", ") || "none detected"}`);
  if (!dry) for (const sub of ["chats", "context", "scheduled"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  else if (!existed) io.log(`  would create projects/${slug}/{chats,context,scheduled}`);
  writeIfMissing(path.join(dir, "instructions.md"), renderInstructions({ slug, sourcePath: source, stack }), dry, io);
  writeIfMissing(path.join(dir, "memory.md"), renderMemory({ slug, date, stack }), dry, io);
  const aliased = addAlias(slug, path.basename(source), dry);
  if (aliased) io.log(`  ${dry ? "would add" : "added   "} alias "${path.basename(source)}" -> ${slug} in projects/.sources.json`);

  if (flag("activate", argv) && !dry) {
    fs.writeFileSync(path.join(ROOT, "projects", ".active"), slug + "\n");
    io.log(`  activated ${slug}`);
  }
  if (flag("sync", argv) && !dry) {
    io.log(`Running sync for ${slug}...`);
    const r = spawnSync(process.execPath, [path.join(__dirname, "sync.js"), "--project", slug], { stdio: "inherit" });
    if (r.status !== 0) throw new CliError(`sync exited with code ${r.status}`, r.status || 1);
  } else if (!dry) {
    io.log(`Next: node tools/sync.js --project ${slug} --dry-run   (then without --dry-run)`);
  }
  io.log("Codex chats are not part of sync: node tools/import-codex-chats.js --from <match> --project " + slug + " [--dry-run]");
  return { slug, source, stack, created: !existed, aliased };
}

module.exports = { run };

if (require.main === module) runAsScript((argv, io) => run(argv, io));

#!/usr/bin/env node
// @ts-check
// One-time, idempotent registration of existing artifacts in the registry (EP-25.03 RF4).
// Today it covers Canvas boards (projects/<slug>/canvas/<uuid>.json, including mind maps and diagrams) for every
// project and for the personal workspace. A board already registered under the same source key is skipped, so a
// second run changes nothing. Nothing is moved or rewritten: files are only read.
//
//   node tools/migrate/artifact-registry-import.js [--projects <dir>] [--project <slug>] [--dry-run]
const fs = require("fs");
const path = require("path");
const { openCliDatabase } = require("../lib/db-client");
const { createArtifactRepo } = require("../../ui/server/db/repos/artifact.repo");
const { canvasRegistration } = require("../../ui/server/services/artifacts/artifact-canvas");
const { ROOT } = require("../lib/root");

const BOARD_FILE = /^[0-9a-f-]{36}\.json$/;

/**
 * @param {ReturnType<typeof createArtifactRepo>} repo @param {string} projectsDir
 * @param {{ project?: string }} [options]
 * @returns {{ registered: number, skipped: number, unknown: number, failed: string[], byType: Record<string, number> }}
 */
function importArtifacts(repo, projectsDir, options = {}) {
  const totals = { registered: 0, skipped: 0, unknown: 0, failed: /** @type {string[]} */ ([]), byType: /** @type {Record<string, number>} */ ({}) };
  const owners = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template" && (!options.project || d.name === options.project))
    .map((d) => d.name);
  for (const owner of owners) {
    const dir = path.join(projectsDir, owner, "canvas");
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((f) => BOARD_FILE.test(f)).sort()) {
      const file = path.join(dir, name);
      try {
        const input = canvasRegistration(owner, JSON.parse(fs.readFileSync(file, "utf8")), file);
        if (!input) { totals.unknown += 1; continue; }
        const { created } = repo.register({ ...input, actor: "importer" });
        totals[created ? "registered" : "skipped"] += 1;
        if (created) totals.byType[input.type] = (totals.byType[input.type] || 0) + 1;
      } catch (error) {
        totals.failed.push(`${owner}/canvas/${name}: ${/** @type {any} */ (error).message}`);
      }
    }
  }
  return totals;
}

function main(argv = process.argv.slice(2)) {
  const arg = (/** @type {string} */ name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const projectsDir = path.resolve(arg("--projects") || process.env.HARNESS_PROJECTS_DIR || path.join(ROOT, "projects"));
  const db = openCliDatabase();
  try {
    const repo = createArtifactRepo(db);
    const run = () => importArtifacts(repo, projectsDir, { project: arg("--project") });
    if (!argv.includes("--dry-run")) return console.log(JSON.stringify(run(), null, 2));
    // Dry run: the whole import runs inside a transaction that is always rolled back.
    let totals;
    try {
      repo.transaction(() => { totals = run(); throw new Error("dry-run"); });
    } catch (error) {
      if (!totals) throw error;
    }
    console.log(JSON.stringify({ dryRun: true, ...totals }, null, 2));
  } finally {
    db.close();
  }
}

if (require.main === module) main();

module.exports = { importArtifacts };

#!/usr/bin/env node
// @ts-check
// Executive report of what was delivered in a period: merges on main, the stories they name (status, pending items
// and open acceptance criteria from each story's evidence section) and totals. The data comes from git and the
// story files only, so keeping merge subjects ("Merge EP-23.05: ...") and evidence sections accurate is what makes
// the report right.
//
//   node tools/exec-report.js [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--branch main] [--out file.md]
//   default period: the last 7 days; default output: stdout.
const fs = require("fs");
const path = require("path");
const { gitMerges, gitTotals, findStory } = require("./lib/exec-report/collect");
const { renderReport } = require("./lib/exec-report/render");

const ROOT = path.join(__dirname, "..");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {Date} d */
const iso = (d) => d.toISOString().slice(0, 10);

/** @param {string[]} argv */
function options(argv) {
  const arg = (/** @type {string} */ name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const until = arg("--until") || iso(new Date());
  const since = arg("--since") || iso(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  for (const [name, value] of [["--since", since], ["--until", until]]) {
    if (!DATE.test(value)) throw new Error(`${name} must be YYYY-MM-DD`);
  }
  return { since, until, branch: arg("--branch") || "main", out: arg("--out") };
}

/** @param {string} root @param {ReturnType<typeof options>} opts */
function buildReport(root, opts) {
  const merges = gitMerges(root, opts.since, opts.until, opts.branch);
  /** @type {Map<string, import("./lib/exec-report/collect").Story | null>} */
  const stories = new Map();
  for (const id of merges.flatMap((m) => m.stories)) if (!stories.has(id)) stories.set(id, findStory(root, id));
  return renderReport({ since: opts.since, until: opts.until, merges, stories, totals: gitTotals(root, opts.since, opts.until, opts.branch) });
}

if (require.main === module) {
  try {
    const opts = options(process.argv.slice(2));
    const report = buildReport(ROOT, opts);
    if (opts.out) {
      fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
      fs.writeFileSync(opts.out, report, "utf8");
      console.log(`report written to ${opts.out}`);
    } else process.stdout.write(report);
  } catch (error) {
    console.error(`exec-report: ${/** @type {any} */ (error).message}`);
    process.exit(1);
  }
}

module.exports = { buildReport, options };

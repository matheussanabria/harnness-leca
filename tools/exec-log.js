#!/usr/bin/env node
// @ts-check
"use strict";
// Executive log: a short, evidence-backed record of what was done, decided, found and left open, plus the fact sheet
// the executive report (tools/exec-report.js) reads. See docs/executive/README.md.
//   node tools/exec-log.js add --kind delivery --title "..." --summary "..." [--epic EP-24] [--story 24.06]
//        [--evidence a,b] [--metrics tests_pass=2889,tests_fail=0] [--resolves L-0003] [--key k] [--by claude] [--date AAAA-MM-DD]
//   node tools/exec-log.js list [--kind k] [--epic EP-24] [--from AAAA-MM-DD] [--to AAAA-MM-DD]
//   node tools/exec-log.js verify                      evidence that does not exist, duplicate ids
//   node tools/exec-log.js report [--since D] [--until D] [--out file.md]    same as npm run report (tools/exec-report.js)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { ROOT } = require("./lib/root");
const store = require("./lib/exec-log/store");
const { buildReport, options: reportOptions } = require("./exec-report");

/** git without the variables a hook exports, so a call made from a hook still reaches the right repository. @param {string} root */
const defaultGit = (root) => (/** @type {string[]} */ args) => {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"]) delete env[name];
  return execFileSync("git", args, { cwd: root, encoding: "utf8", env });
};

const USAGE = "Usage: node tools/exec-log.js add|list|verify|report (see the header of this file or docs/executive/README.md)";

/** "a=1,b=2" to { a: 1, b: 2 }. @param {string | undefined} text */
function parseMetrics(text) {
  if (text === undefined) return undefined;
  /** @type {Record<string, number>} */ const out = {};
  for (const pair of text.split(",").filter(Boolean)) {
    const [name, value] = pair.split("=");
    out[name] = Number(value);
  }
  return out;
}

/** @param {string} name @param {string[]} argv */
const list = (name, argv) => (opt(name, argv) === undefined ? undefined : /** @type {string} */ (opt(name, argv)).split(",").map((s) => s.trim()).filter(Boolean));

/** @param {string[]} argv @param {Pick<Console, "log">} io @param {{ root?: string, now?: () => Date, git?: (args: string[]) => string }} [env] */
function main(argv, io = console, env = {}) {
  const root = env.root || ROOT;
  const file = store.logFile(root);
  const command = argv[0];

  if (command === "add") {
    const input = {
      kind: opt("kind", argv), title: opt("title", argv), summary: opt("summary", argv),
      epic: opt("epic", argv), story: opt("story", argv), date: opt("date", argv), by: opt("by", argv), key: opt("key", argv),
      resolves: opt("resolves", argv), evidence: list("evidence", argv), metrics: parseMetrics(opt("metrics", argv)),
    };
    for (const key of Object.keys(input)) if (/** @type {any} */ (input)[key] === undefined) delete (/** @type {any} */ (input))[key];
    try {
      const { entry, duplicate } = store.appendEntry(file, input, { now: env.now });
      io.log(duplicate ? `${entry.id} already exists for key "${entry.key}"; nothing added` : `${entry.id} registered (${entry.kind}, ${entry.date})`);
    } catch (error) {
      throw new CliError(`Not registered: ${/** @type {Error} */ (error).message}`);
    }
    return;
  }

  if (command === "list") {
    const from = opt("from", argv); const to = opt("to", argv); const kind = opt("kind", argv); const epic = opt("epic", argv);
    for (const e of store.readEntries(file)) {
      if ((from && e.date < from) || (to && e.date > to) || (kind && e.kind !== kind) || (epic && e.epic !== epic)) continue;
      io.log(`${e.id}\t${e.date}\t${e.kind}\t${e.epic || "-"}${e.story ? ` ${e.story}` : ""}\t${e.title}`);
    }
    return;
  }

  if (command === "verify") {
    const entries = store.readEntries(file);
    const git = env.git || defaultGit(root);
    const broken = store.findBrokenEvidence(entries, {
      pathExists: (p) => fs.existsSync(path.join(root, p)),
      commitExists: (h) => { try { git(["cat-file", "-e", `${h}^{commit}`]); return true; } catch { return false; } },
    });
    const dupes = store.duplicateIds(entries);
    for (const b of broken) io.log(`${b.id}: ${b.reason}: ${b.evidence}`);
    for (const id of dupes) io.log(`${id}: duplicate id`);
    if (broken.length || dupes.length) throw new CliError(`${broken.length} broken evidence item(s), ${dupes.length} duplicate id(s)`);
    io.log(`ok: ${entries.length} entries, all evidence found`);
    return;
  }

  if (command === "report") {
    // One report generator: tools/exec-report.js reads git, the stories, the dossiers and this log.
    let opts;
    try { opts = reportOptions(argv.slice(1)); } catch (error) { throw new CliError(/** @type {Error} */ (error).message); }
    const report = buildReport(root, opts);
    if (opts.out) {
      fs.mkdirSync(path.dirname(path.resolve(root, opts.out)), { recursive: true });
      fs.writeFileSync(path.resolve(root, opts.out), report, "utf8");
      io.log(`report written to ${opts.out}`);
    } else io.log(report);
    return;
  }

  if (flag("help", argv) || !command) io.log(USAGE);
  else throw new CliError(`Unknown command "${command}". ${USAGE}`);
}

module.exports = { main, parseMetrics };
if (require.main === module) runAsScript(main);

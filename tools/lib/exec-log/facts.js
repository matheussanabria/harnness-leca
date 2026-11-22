// @ts-check
"use strict";
// Facts for the executive report, taken from sources that already exist: git history, story files and feature dossiers.
// Nothing here is estimated: a number is either read from one of those sources or it is absent.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { parseStages } = require("../scrum-cli/done-check-stages");

/** Environment without the variables a git hook exports, so a call made from a hook still hits the right repository. */
const cleanEnv = () => {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"]) delete env[name];
  return env;
};

/** @param {string} root @returns {(args: string[]) => string} */
const defaultGit = (root) => (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: cleanEnv() });

/** Conventional commit subject to type and scope; merges are their own type. @param {string} subject */
function parseSubject(subject) {
  if (/^Merge\b/.test(subject)) return { type: "merge", scope: "" };
  const m = /^([a-z]+)(?:\(([^)]+)\))?!?:/.exec(subject);
  return { type: m ? m[1] : "other", scope: m && m[2] ? m[2] : "" };
}

/**
 * Commits in a date range (both ends inclusive, local dates), with the files and line counts of non-merge commits.
 * @param {{ from: string, to: string }} range @param {(args: string[]) => string} git
 * @returns {{ hash: string, date: string, subject: string, type: string, scope: string, files: string[], insertions: number, deletions: number }[]}
 */
function collectCommits(range, git) {
  const out = git(["log", "main", `--since=${range.from} 00:00:00`, `--until=${range.to} 23:59:59`, "--date=short", "--pretty=format:@@%h|%ad|%s", "--numstat"]);
  /** @type {any[]} */ const commits = [];
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith("@@")) {
      const [hash, date, ...rest] = line.slice(2).split("|");
      const subject = rest.join("|");
      commits.push({ hash, date, subject, ...parseSubject(subject), files: [], insertions: 0, deletions: 0 });
    } else if (line.trim() && commits.length) {
      const [ins, del, file] = line.split("\t");
      const current = commits[commits.length - 1];
      if (file) current.files.push(file);
      current.insertions += Number(ins) || 0; // binary files show "-"
      current.deletions += Number(del) || 0;
    }
  }
  return commits;
}

/** Front matter `key: value` pairs of a markdown text (flat keys only). @param {string} text */
function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  /** @type {Record<string, string>} */ const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

const readText = (/** @type {string} */ file) => { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } };

/**
 * Stories and epic READMEs among the touched files, with their current status.
 * @param {string} root @param {string[]} touched
 * @returns {{ id: string, epic: string, title: string, status: string, file: string }[]}
 */
function collectStories(root, touched) {
  const seen = new Set();
  /** @type {any[]} */ const out = [];
  for (const file of touched) {
    if (!/^docs\/harness-evolution\/02-epics\/[^/]+\/\d+\.\d+-[^/]+\.md$/.test(file) || seen.has(file)) continue;
    seen.add(file);
    const fm = frontMatter(readText(path.join(root, file)));
    if (!fm.id) continue;
    out.push({ id: fm.id.replace(/^EP-/, ""), epic: fm.epico || fm.id.replace(/^EP-(\d+)\..*$/, "EP-$1"), title: fm.titulo || fm.title || "", status: fm.status || "?", file });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Feature dossiers among the touched files: route, stage counts and how many evidence files they hold.
 * @param {string} root @param {string[]} touched
 */
function collectDossiers(root, touched) {
  const folders = [...new Set(touched.map((f) => /^docs\/features\/([^/]+)\//.exec(f)?.[1]).filter(Boolean))];
  return folders.flatMap((slug) => {
    const text = readText(path.join(root, "docs", "features", /** @type {string} */ (slug), "_status.md"));
    if (!text) return [];
    const fm = frontMatter(text);
    const stages = parseStages(text);
    let evidenceFiles = 0;
    try { evidenceFiles = fs.readdirSync(path.join(root, "docs", "features", /** @type {string} */ (slug), "evidence")).length; } catch { /* no evidence folder */ }
    return [{
      slug: /** @type {string} */ (slug), story: fm.story || "", route: fm.route || "",
      done: stages.filter((s) => s.status === "done").length,
      skipped: stages.filter((s) => s.status === "skipped").length,
      open: stages.filter((s) => s.status !== "done" && s.status !== "skipped").length,
      evidenceFiles,
    }];
  });
}

/**
 * Everything the fact sheet needs, for a date range.
 * @param {string} root @param {{ from: string, to: string }} range @param {(args: string[]) => string} [git]
 */
function collectFacts(root, range, git = defaultGit(root)) {
  const commits = collectCommits(range, git);
  const touched = [...new Set(commits.flatMap((c) => c.files))];
  const real = commits.filter((c) => c.type !== "merge");
  /** @type {Record<string, number>} */ const byType = {};
  for (const c of commits) byType[c.type] = (byType[c.type] || 0) + 1;
  return {
    range, commits, byType,
    filesChanged: new Set(real.flatMap((c) => c.files)).size,
    insertions: real.reduce((n, c) => n + c.insertions, 0),
    deletions: real.reduce((n, c) => n + c.deletions, 0),
    stories: collectStories(root, touched),
    dossiers: collectDossiers(root, touched),
  };
}

module.exports = { collectFacts, collectCommits, collectStories, collectDossiers, parseSubject, frontMatter, defaultGit };

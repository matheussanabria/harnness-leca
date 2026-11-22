// @ts-check
// Data for the executive report (tools/exec-report.js): the merges on main in a period, the stories they name and
// what each story's evidence section says is still pending. Parsing is pure; only gitMerges/gitTotals run git.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const EPICS_DIR = path.join("docs", "harness-evolution", "02-epics");

/** @typedef {{ hash: string, date: string, subject: string, epic: string|null, stories: string[], kind: string }} Merge */
/** @typedef {{ id: string, epic: string, title: string, status: string, file: string, pending: string[], divergences: string[], openCriteria: string[] }} Story */

/**
 * Reads "Merge EP-23.05: ..." style subjects. "EP-24.01, 24.02 and 24.04" names three stories; "EP-24 acceptance"
 * names the epic only. Anything else is an "other" delivery (fixes, tooling).
 * @param {string} line "hash|date|subject"
 * @returns {Merge}
 */
function parseMergeLine(line) {
  const [hash, date, ...rest] = line.split("|");
  const subject = rest.join("|").replace(/^Merge\s+/i, "").trim();
  const epicMatch = /\bEP-(\d+)/.exec(subject);
  const head = subject.split(":")[0];
  const stories = epicMatch ? [...head.matchAll(/(?:EP-)?(\d+)\.(\d+)/g)].map((m) => `${m[1]}.${m[2]}`) : [];
  // A story id in the head is a story delivery (its file's status tells planned from done); an epic alone is
  // planning or acceptance of the whole epic.
  const kind = !epicMatch ? "other" : stories.length ? "story" : "epic";
  return { hash, date, subject, epic: epicMatch ? `EP-${epicMatch[1]}` : null, stories, kind };
}

/** Lines of a markdown section, from its "## N. Title" heading to the next "## ". @param {string} text @param {RegExp} heading */
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** Text of the evidence bullets that start with one of the labels ("**Pendente:**"). @param {string[]} lines @param {RegExp} label */
function bullets(lines, label) {
  return lines
    .map((l) => /^\s*-\s+\*\*([^*]+)\*\*:?\s*(.*)$/.exec(l))
    .filter((m) => m && label.test(m[1]))
    .map((m) => /** @type {RegExpExecArray} */ (m)[2].trim())
    .filter(Boolean);
}

/** Frontmatter value. @param {string} text @param {string} key */
function front(text, key) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const m = fm && new RegExp(`^${key}:\\s*(.*)$`, "m").exec(fm[1]);
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

/** @param {string} text @param {string} file @returns {Story} */
function parseStory(text, file) {
  const evidence = section(text, /Evid[eê]ncia|Evidence/i);
  return {
    id: front(text, "id").replace(/^EP-/, ""),
    epic: front(text, "epico"),
    title: front(text, "titulo"),
    status: front(text, "status"),
    file,
    pending: bullets(evidence, /Pendente|Pending/i),
    divergences: bullets(evidence, /Diverg/i),
    openCriteria: section(text, /Crit[eé]rios de aceite|Acceptance criteria/i)
      .filter((l) => /^\s*-\s+\[ \]/.test(l))
      .map((l) => l.replace(/^\s*-\s+\[ \]\s*/, "").trim()),
  };
}

/** Finds the story file "NN.MM-*.md" under the epics folder. @param {string} root @param {string} id */
function findStory(root, id) {
  const dir = path.join(root, EPICS_DIR);
  if (!fs.existsSync(dir)) return null;
  for (const epic of fs.readdirSync(dir)) {
    const epicDir = path.join(dir, epic);
    if (!fs.statSync(epicDir).isDirectory()) continue;
    const name = fs.readdirSync(epicDir).find((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
    if (name) {
      const file = path.join(epicDir, name);
      return parseStory(fs.readFileSync(file, "utf8"), path.relative(root, file).replace(/\\/g, "/"));
    }
  }
  return null;
}

/** @param {string} root @param {string} since YYYY-MM-DD @param {string} [until] @param {string} [branch] @returns {Merge[]} */
function gitMerges(root, since, until, branch = "main") {
  const args = ["log", "--first-parent", "--merges", `--since=${since} 00:00`, "--format=%h|%cs|%s", branch];
  if (until) args.splice(4, 0, `--until=${until} 23:59`);
  const out = execFileSync("git", args, { cwd: root, encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean).map(parseMergeLine).reverse();
}

/** Commits and changed lines on the branch in the period. @param {string} root @param {string} since @param {string} [until] @param {string} [branch] */
function gitTotals(root, since, until, branch = "main") {
  const range = ["--since", `${since} 00:00`, ...(until ? ["--until", `${until} 23:59`] : [])];
  const commits = execFileSync("git", ["rev-list", "--count", "--no-merges", ...range, branch], { cwd: root, encoding: "utf8" }).trim();
  const stat = execFileSync("git", ["log", "--no-merges", "--shortstat", "--format=", ...range, branch], { cwd: root, encoding: "utf8" });
  const sum = (/** @type {RegExp} */ re) => [...stat.matchAll(re)].reduce((n, m) => n + Number(m[1]), 0);
  return { commits: Number(commits) || 0, insertions: sum(/(\d+) insertions?/g), deletions: sum(/(\d+) deletions?/g) };
}

module.exports = { parseMergeLine, parseStory, findStory, gitMerges, gitTotals, section, bullets };

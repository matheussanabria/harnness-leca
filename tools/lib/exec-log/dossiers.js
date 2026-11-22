// @ts-check
"use strict";
// Feature dossiers (docs/features/<slug>/_status.md) of the stories delivered in a period: route, how many stages are
// done, skipped (with a reason) or open, and how many evidence files each one holds. Read by tools/exec-report.js
// for the "Qualidade do processo" section. Nothing is estimated: a number is read from the dossier or it is absent.
const fs = require("fs");
const path = require("path");
const { parseStages } = require("../scrum-cli/done-check-stages");

/** Flat front matter `key: value` pairs. @param {string} text */
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

/** "EP-24.03" and "EP-24.03-fix" both belong to story 24.03. @param {string} value */
const storyIdOf = (value) => /^(?:EP-)?(\d+\.\d+)/.exec(value)?.[1] || "";

/**
 * @param {string} root
 * @param {string[]} storyIds ids such as "24.03"; an empty list returns nothing
 * @returns {{ slug: string, story: string, route: string, done: number, skipped: number, open: number, evidenceFiles: number }[]}
 */
function collectDossiers(root, storyIds) {
  const wanted = new Set(storyIds);
  const base = path.join(root, "docs", "features");
  let slugs = [];
  try { slugs = fs.readdirSync(base); } catch { return []; }
  /** @type {any[]} */ const out = [];
  for (const slug of slugs.sort()) {
    let text = "";
    try { text = fs.readFileSync(path.join(base, slug, "_status.md"), "utf8"); } catch { continue; }
    const fm = frontMatter(text);
    if (!wanted.has(storyIdOf(fm.story || ""))) continue;
    const stages = parseStages(text);
    let evidenceFiles = 0;
    try { evidenceFiles = fs.readdirSync(path.join(base, slug, "evidence")).length; } catch { /* no evidence folder */ }
    out.push({
      slug, story: fm.story || "", route: fm.route || "",
      done: stages.filter((s) => s.status === "done").length,
      skipped: stages.filter((s) => s.status === "skipped").length,
      open: stages.filter((s) => s.status !== "done" && s.status !== "skipped").length,
      evidenceFiles,
    });
  }
  return out;
}

module.exports = { collectDossiers, frontMatter, storyIdOf };

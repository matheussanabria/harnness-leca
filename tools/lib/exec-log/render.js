// @ts-check
"use strict";
// Renders the fact sheet: the only numbers and claims the executive report may use. Markdown, agent-facing (English);
// the report itself is written for the reader from this sheet. Pure: takes facts and log entries, returns text.
const { openItems } = require("./store");

/** @param {string[][]} rows @param {string[]} header */
const table = (header, rows) => [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "/")).join(" | ")} |`)].join("\n");

const ACCEPTED = new Set(["concluida", "concluido"]);
const IN_REVIEW = new Set(["implementada", "em-revisao", "em-andamento"]);

/** @param {{ id: string, title: string, summary: string, evidence: string[], epic?: string, story?: string, date: string, by: string }} e */
const entryLine = (e) => `- **${e.id}** (${e.date}${e.epic ? `, ${e.epic}${e.story ? ` ${e.story}` : ""}` : ""}) ${e.title}. ${e.summary}${e.evidence.length ? ` Evidence: ${e.evidence.map((x) => `\`${x}\``).join(", ")}.` : ""}`;

/**
 * @param {ReturnType<typeof import("./facts").collectFacts>} facts
 * @param {import("./store").Entry[]} entries all log entries; the date range and epic filter are applied here
 * @param {{ epic?: string }} [options]
 */
function renderFactSheet(facts, entries, options = {}) {
  const { from, to } = facts.range;
  const inRange = entries.filter((e) => e.date >= from && e.date <= to && (!options.epic || e.epic === options.epic));
  const stories = options.epic ? facts.stories.filter((s) => s.epic === options.epic) : facts.stories;
  const kind = (/** @type {string} */ k) => inRange.filter((e) => e.kind === k);
  const lines = [`# Executive fact sheet: ${from} to ${to}${options.epic ? ` (${options.epic})` : ""}`, ""];
  lines.push("Built by `tools/exec-log.js report` from git, story files, feature dossiers and `docs/executive/log.jsonl`. A report may cite only what is on this sheet.", "");

  lines.push("## Totals", "");
  const types = Object.entries(facts.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ");
  lines.push(`- Commits on main: ${facts.commits.length}${types ? ` (${types})` : ""}`);
  lines.push(`- Files changed (non-merge commits): ${facts.filesChanged}; lines +${facts.insertions} / -${facts.deletions}`);
  lines.push(`- Stories touched: ${stories.length} (accepted ${stories.filter((s) => ACCEPTED.has(s.status)).length}, implemented or in review ${stories.filter((s) => IN_REVIEW.has(s.status)).length}, planned ${stories.filter((s) => !ACCEPTED.has(s.status) && !IN_REVIEW.has(s.status)).length})`);
  const open = facts.dossiers.reduce((n, d) => n + d.open, 0);
  lines.push(`- Feature dossiers touched: ${facts.dossiers.length} (stages done ${facts.dossiers.reduce((n, d) => n + d.done, 0)}, skipped with reason ${facts.dossiers.reduce((n, d) => n + d.skipped, 0)}, open ${open}; evidence files ${facts.dossiers.reduce((n, d) => n + d.evidenceFiles, 0)})`);
  const byKind = Object.entries(inRange.reduce((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] || 0) + 1 }), /** @type {Record<string, number>} */ ({}))).map(([k, n]) => `${k} ${n}`).join(", ");
  lines.push(`- Log entries: ${inRange.length}${byKind ? ` (${byKind})` : ""}`, "");

  if (stories.length) {
    lines.push("## Stories", "", table(["Epic", "Story", "Title", "Status"], stories.map((s) => [s.epic, s.id, s.title, s.status])), "");
  }
  if (facts.dossiers.length) {
    lines.push("## Dossiers", "", table(["Dossier", "Story", "Route", "Done", "Skipped", "Open", "Evidence files"], facts.dossiers.map((d) => [d.slug, d.story, d.route, d.done, d.skipped, d.open, d.evidenceFiles])), "");
  }
  for (const [k, heading] of /** @type {[string, string][]} */ ([["delivery", "Delivered"], ["decision", "Decisions"], ["finding", "Findings"], ["correction", "Corrections (including our own mistakes)"], ["approval", "Approvals"]])) {
    const items = kind(k);
    if (items.length) lines.push(`## ${heading}`, "", ...items.map(entryLine), "");
  }
  const metrics = kind("metric").concat(inRange.filter((e) => e.kind !== "metric" && e.metrics));
  if (metrics.length) {
    const names = [...new Set(metrics.flatMap((e) => Object.keys(e.metrics || {})))];
    lines.push("## Metrics", "", table(["Date", "Entry", ...names], metrics.map((e) => [e.date, e.id, ...names.map((n) => e.metrics && n in e.metrics ? e.metrics[n] : "")])), "");
  }
  const pending = openItems(entries).filter((e) => (!options.epic || e.epic === options.epic) && e.date <= to);
  lines.push("## Open items (pending and risks not yet resolved)", "", ...(pending.length ? pending.map((e) => `${entryLine(e)} [${e.kind}]`) : ["- None."]), "");
  const evidence = [...new Set(inRange.flatMap((e) => e.evidence))];
  if (evidence.length) lines.push("## Evidence index", "", ...evidence.map((x) => `- \`${x}\``), "");
  return `${lines.join("\n").trimEnd()}\n`;
}

module.exports = { renderFactSheet };

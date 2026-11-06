// @ts-check
"use strict";
// Aggregates probe runs into a Markdown table: one row per scenario, one column per model, plus failure codes.

/** @typedef {{ model: string, scenario: string, run: number, verdict: string, codes: string[], error?: string, ms?: number }} Row */

/** @param {Row[]} rows */
function summarize(rows) {
  /** @type {Map<string, {pass: number, total: number}>} */
  const byModel = new Map();
  for (const row of rows) {
    const s = byModel.get(row.model) || { pass: 0, total: 0 };
    s.total += 1;
    if (row.verdict === "PASS") s.pass += 1;
    byModel.set(row.model, s);
  }
  return byModel;
}

/** @param {Row[]} rows @param {{ title?: string }} [opts] */
function toMarkdown(rows, opts = {}) {
  const models = [...new Set(rows.map((r) => r.model))];
  const scenarios = [...new Set(rows.map((r) => r.scenario))];
  const cell = (/** @type {string} */ scenario, /** @type {string} */ model) => {
    const hits = rows.filter((r) => r.scenario === scenario && r.model === model);
    if (!hits.length) return "-";
    const passed = hits.filter((r) => r.verdict === "PASS").length;
    const codes = [...new Set(hits.flatMap((r) => (r.error ? ["ERROR"] : r.codes.filter((c) => !c.startsWith("note:")))))];
    return `${passed}/${hits.length}${codes.length ? ` ${codes.join(",")}` : ""}`;
  };
  const lines = [`# ${opts.title || "Canvas chat probe"}`, "", `| Scenario | ${models.join(" | ")} |`, `|---|${models.map(() => "---").join("|")}|`];
  for (const scenario of scenarios) lines.push(`| ${scenario} | ${models.map((m) => cell(scenario, m)).join(" | ")} |`);
  lines.push("", "## Pass rate");
  for (const [model, s] of summarize(rows)) lines.push(`- ${model}: ${s.pass}/${s.total} (${Math.round((100 * s.pass) / s.total)}%)`);
  return lines.join("\n");
}

module.exports = { summarize, toMarkdown };

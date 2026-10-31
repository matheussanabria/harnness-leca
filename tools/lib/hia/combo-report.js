// @ts-check
// Summarizes the 9Router combo suggestions recorded by the HIA dispatcher (executorType "cloud").
// Pure functions over JSONL lines; the CLI in tools/hia-combo-report.js handles files and output.

/**
 * Parses JSONL text and keeps only cloud-route records that carry a combo suggestion.
 * @param {string} text
 * @returns {Array<Record<string, any>>}
 */
function parseSuggestions(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec && rec.executorType === "cloud" && rec.suggestedCombo) out.push(rec);
    } catch {}
  }
  return out;
}

/** @param {Array<Record<string, any>>} recs @param {string} key */
function countBy(recs, key) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const r of recs) counts[r[key] || "unknown"] = (counts[r[key] || "unknown"] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

/**
 * Builds the measurement summary: totals, distribution and a sample for manual review.
 * @param {Array<Record<string, any>>} recs
 * @param {{since?: string, project?: string, sample?: number}} [opts]
 */
function summarize(recs, opts = {}) {
  const since = opts.since ? Date.parse(opts.since) : NaN;
  const filtered = recs.filter((r) => {
    if (opts.project && r.project !== opts.project) return false;
    if (!Number.isNaN(since) && Date.parse(r.recordedAt || "") < since) return false;
    return true;
  });
  const total = filtered.length;
  const general = filtered.filter((r) => r.suggestedType === "general").length;
  // Most recent first; the sample only includes records with a preview to review.
  const sample = filtered
    .filter((r) => r.promptPreview)
    .slice(-Math.max(0, opts.sample ?? 30))
    .reverse()
    .map((r) => ({ at: r.recordedAt, project: r.project, type: r.suggestedType, combo: r.suggestedCombo, preview: r.promptPreview }));
  return {
    total,
    generalShare: total ? Math.round((general / total) * 100) : 0,
    byType: countBy(filtered, "suggestedType"),
    byCombo: countBy(filtered, "suggestedCombo"),
    byEngine: countBy(filtered, "executorId"),
    sample,
  };
}

module.exports = { parseSuggestions, summarize };

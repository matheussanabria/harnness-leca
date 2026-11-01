// @ts-check
// Runs the answer sensors: every fenced code block of a chat answer goes through the checkers that apply to its
// language, plus text-level rules. Report-only (never blocks or edits the answer); HIA_SENSORS=false turns it off.
const { extractBlocks } = require("./extract");
const { biomeSensor } = require("./biome");
const { jsonSensor, pythonSensor, javaSensor } = require("./syntax");
const { secretsRule, emojiRule, testRule, mermaidRule, fenceRule } = require("./rules");

/** @typedef {{ sensor: string, severity: "error" | "warning", line: number, message: string }} Finding */
/** @typedef {Finding & { lang?: string }} ReportedFinding */

const MAX_BLOCKS = 12;
const MAX_CHARS = 20000;
const DEFAULT_BUDGET_MS = 25000;

/** Process-based sensors by language. */
const PROCESS_SENSORS = /** @type {Record<string, Array<(b: {lang: string, code: string}) => Promise<{findings: Finding[], skipped?: string}>>>} */ ({
  js: [biomeSensor], jsx: [biomeSensor], ts: [biomeSensor], tsx: [biomeSensor], css: [biomeSensor],
  json: [jsonSensor], python: [pythonSensor], java: [javaSensor],
});

/**
 * @param {string} text the model answer
 * @param {{ env?: Record<string, string | undefined>, budgetMs?: number }} [o]
 * @returns {Promise<{ findings: ReportedFinding[], skipped: string[], blocks: number, ms: number, disabled?: boolean }>}
 */
async function runSensors(text, { env = process.env, budgetMs = DEFAULT_BUDGET_MS } = {}) {
  const started = Date.now();
  if (env.HIA_SENSORS === "false") return { findings: [], skipped: [], blocks: 0, ms: 0, disabled: true };
  const answer = String(text || "");
  const { blocks, unclosedFence } = extractBlocks(answer);
  /** @type {ReportedFinding[]} */
  const findings = [...secretsRule(answer), ...fenceRule(unclosedFence)];
  /** @type {string[]} */
  const skipped = [];

  for (const block of blocks.slice(0, MAX_BLOCKS)) {
    if (Date.now() - started > budgetMs) { skipped.push("time budget reached"); break; }
    const code = block.code.slice(0, MAX_CHARS);
    const here = { lang: block.lang, code };
    const rules = [...emojiRule(here), ...testRule(here), ...mermaidRule(here)];
    const settled = await Promise.all((PROCESS_SENSORS[block.lang] || []).map((s) => s(here).catch((/** @type {Error} */ e) => ({ findings: /** @type {Finding[]} */ ([]), skipped: `sensor failed: ${e.message}` }))));
    for (const r of settled) if (r.skipped) skipped.push(`${block.lang}: ${r.skipped}`);
    // Lines are relative to the block; shift them to the answer so a reader can find them.
    for (const f of [...rules, ...settled.flatMap((r) => r.findings)]) findings.push({ ...f, lang: block.lang, line: f.line + block.line - 1 });
  }
  if (blocks.length > MAX_BLOCKS) skipped.push(`${blocks.length - MAX_BLOCKS} more block(s) not checked`);
  return { findings, skipped: [...new Set(skipped)], blocks: blocks.length, ms: Date.now() - started };
}

/** One short line per error finding, for the chat notice. Warnings stay in telemetry only. */
function summarizeErrors(findings, limit = 3) {
  return findings.filter((f) => f.severity === "error").slice(0, limit).map((f) => `${f.lang ? f.lang + " " : ""}line ${f.line}: ${f.message}`);
}

module.exports = { runSensors, summarizeErrors };

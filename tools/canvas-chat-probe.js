#!/usr/bin/env node
// @ts-check
"use strict";
// P-109: checks whether real models obey the <mindmap> and <board> chat formats of the Canvas bridges.
// Builds the real prompt, asks the engine, and judges the answer with the app's own extractors and parsers.
const fs = require("node:fs");
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const { SCENARIOS } = require("./lib/canvas-probe/scenarios");
const { loadBridgeEnv } = require("./lib/canvas-probe/bridge-env");
const { buildPrompt } = require("./lib/canvas-probe/prompts");
const { judge } = require("./lib/canvas-probe/judge");
const { toMarkdown } = require("./lib/canvas-probe/report");

const USAGE = `Usage: node tools/canvas-chat-probe.js [--list] [--dry] [--engine opencode|claude --allow-claude] [--allow-paid] [--model a,b] [--only id,id] [--repeat n] [--out file.md] [--raw file.json]
  --dry     print the prompts without calling any model
  --allow-paid  lets opencode use non-free models (9router combos, openrouter); they may cost
  claude    only runs with --allow-claude (it spends quota); the default engine is the free opencode`;

/** @param {string[]} argv */
async function main(argv, io = console) {
  if (flag("list", argv)) return SCENARIOS.forEach((s) => io.log(`${s.id}\t${s.kind}\t${s.request}`));
  const engine = opt("engine", argv) || "opencode";
  if (engine === "claude" && !flag("allow-claude", argv)) throw new CliError("Refused: the claude engine spends quota; pass --allow-claude to confirm.");
  if (!["opencode", "claude"].includes(engine)) throw new CliError(USAGE);
  const only = (opt("only", argv) || "").split(",").filter(Boolean);
  const scenarios = SCENARIOS.filter((s) => !only.length || only.includes(s.id));
  if (!scenarios.length) throw new CliError(`No scenario matches --only. ${USAGE}`);
  const env = await loadBridgeEnv();

  if (flag("dry", argv)) {
    for (const s of scenarios) io.log(`===== ${s.id} =====\n${buildPrompt(env, s)}\n`);
    return;
  }
  const { ask, DEFAULT_OPENCODE_MODEL } = require("./lib/llm");
  const models = (opt("model", argv) || (engine === "opencode" ? DEFAULT_OPENCODE_MODEL : "")).split(",");
  const repeat = Math.max(1, Number(opt("repeat", argv)) || 1);
  /** @type {any[]} */ const rows = [];
  /** @type {any[]} */ const raw = [];
  for (const model of models) {
    for (const s of scenarios) {
      const prompt = buildPrompt(env, s);
      for (let run = 1; run <= repeat; run += 1) {
        const started = Date.now();
        try {
          const answer = ask({ engine, model: model || undefined, prompt, allowPaid: flag("allow-paid", argv) });
          const verdict = judge(env, s, answer);
          rows.push({ model: model || engine, scenario: s.id, run, ...verdict, ms: Date.now() - started });
          raw.push({ model, scenario: s.id, run, answer });
        } catch (error) {
          rows.push({ model: model || engine, scenario: s.id, run, verdict: "FAIL", codes: [], error: String(error.message || error).slice(0, 200) });
        }
        io.log(`${model || engine} ${s.id} #${run}: ${rows[rows.length - 1].verdict} ${rows[rows.length - 1].codes?.join(",") || rows[rows.length - 1].error || ""}`);
      }
    }
  }
  const markdown = toMarkdown(rows);
  io.log(`\n${markdown}`);
  if (opt("out", argv)) fs.writeFileSync(/** @type {string} */ (opt("out", argv)), `${markdown}\n`);
  if (opt("raw", argv)) fs.writeFileSync(/** @type {string} */ (opt("raw", argv)), JSON.stringify(raw, null, 2));
}

module.exports = { main };
if (require.main === module) runAsScript(main);

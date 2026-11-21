#!/usr/bin/env node
// @ts-check
"use strict";
// EP-24.04 (RF7): checks whether real models write valid motion@1 timelines through the Atelier tags.
// Builds the real prompt (tag instruction + proto context), asks the engine, applies the motion tags to a temporary
// prototype with the app's own tools, and retries once with the tool errors to measure self-correction.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const { TOOL_INSTRUCTION } = require("../ui/server/services/atelier-tool-instruction.service");
const { buildProtoContext } = require("../ui/server/services/atelier-proto-context.service");
const { parseToolTags } = require("../ui/server/services/atelier-tool-tags.service");
const { executeMotionTool, isMotionTool } = require("../ui/server/services/motion-tools.service");
const { readMotion } = require("../ui/server/services/motion-store.service");

const USAGE = `Usage: node tools/motion-probe.js [--dry] [--engine opencode|claude --allow-claude] [--allow-paid] [--model a,b] [--only id,id] [--out file.md]
  --dry     print the prompts without calling any model
  claude    only runs with --allow-claude (it spends quota); the default engine is the free opencode`;

const SCREEN = `<main class="page" data-pid="p-1">
  <h1 class="title" data-pid="p-2">Ofertas da semana</h1>
  <section class="cards" data-pid="p-3">
    <article class="card" data-pid="p-4">Sedan</article>
    <article class="card" data-pid="p-5">Hatch</article>
    <article class="card" data-pid="p-6">SUV</article>
  </section>
  <button class="cta" data-pid="p-7">Ver estoque</button>
</main>`;

const SCENARIOS = [
  { id: "entrada", request: "Anime a entrada do título: aparece de baixo para cima com fade em 600 ms, ease-out." },
  { id: "cascata", request: "Entrada em cascata dos três cards, 1,2 s no total, ease-out." },
  { id: "destaque", request: "Faça o botão Ver estoque pulsar em loop (escala leve), ciclo de 1,5 s." },
  { id: "saida", request: "Ao final de 2 s, os cards saem com fade para a esquerda." },
];

/** Temporary prototype with one screen, so the real context and store are used. */
function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "motion-probe-"));
  const protoDir = path.join(root, "design", "prototypes", "probe");
  fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
  fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: "probe", screens: [{ id: "home", file: "screens/home.html" }] }));
  fs.writeFileSync(path.join(protoDir, "screens", "home.html"), SCREEN);
  return { root, ctx: { projectDir: root, protoId: "probe" } };
}

/** @param {{ projectDir: string, protoId: string }} ctx @param {string} request */
const buildPrompt = (ctx, request) => `${TOOL_INSTRUCTION}\n\n${buildProtoContext(ctx)}\n\n## Pedido\nTela: home. ${request}`;

/**
 * Applies the motion tags of an answer. @returns {{ calls: number, errors: string[], warnings: string[] }}
 * @param {{ projectDir: string, protoId: string }} ctx @param {string} answer
 */
function apply(ctx, answer) {
  const parsed = parseToolTags(answer);
  const errors = parsed.errors.map((e) => `tag ${e.tool}: ${e.reason}`);
  const warnings = [];
  let calls = 0;
  for (const tc of parsed.toolCalls.filter((c) => isMotionTool(c.name))) {
    calls += 1;
    const res = executeMotionTool(tc.name, tc.args, ctx);
    if (!res.ok) errors.push(`${tc.name}: ${res.error}`);
    else warnings.push(...(/** @type {any} */ (res.result).warnings || []));
  }
  if (!calls) errors.push("no motion tag in the answer");
  return { calls, errors, warnings };
}

/** @param {string[]} argv */
async function main(argv, io = console) {
  const engine = opt("engine", argv) || "opencode";
  if (engine === "claude" && !flag("allow-claude", argv)) throw new CliError("Refused: the claude engine spends quota; pass --allow-claude to confirm.");
  if (!["opencode", "claude"].includes(engine)) throw new CliError(USAGE);
  const only = (opt("only", argv) || "").split(",").filter(Boolean);
  const scenarios = SCENARIOS.filter((s) => !only.length || only.includes(s.id));
  if (!scenarios.length) throw new CliError(`No scenario matches --only. ${USAGE}`);
  if (flag("dry", argv)) {
    const { root, ctx } = makeProject();
    try { for (const s of scenarios) io.log(`===== ${s.id} =====\n${buildPrompt(ctx, s.request)}\n`); } finally { fs.rmSync(root, { recursive: true, force: true }); }
    return;
  }
  const { ask, DEFAULT_OPENCODE_MODEL } = require("./lib/llm");
  const models = (opt("model", argv) || (engine === "opencode" ? DEFAULT_OPENCODE_MODEL : "")).split(",");
  /** @type {any[]} */ const rows = [];
  for (const model of models) {
    for (const s of scenarios) {
      const { root, ctx } = makeProject();
      const row = { model: model || engine, scenario: s.id, first: "FAIL", second: "-", orphans: 0, note: "" };
      try {
        const prompt = buildPrompt(ctx, s.request);
        const askOnce = (/** @type {string} */ p) => ask({ engine, model: model || undefined, prompt: p, allowPaid: flag("allow-paid", argv) });
        let result = apply(ctx, askOnce(prompt));
        row.first = result.errors.length ? "FAIL" : "PASS";
        if (result.errors.length) {
          const retry = `${prompt}\n\n## Resultado das suas ferramentas\n${result.errors.join("\n")}\nCorrija e reenvie as tags.`;
          result = apply(ctx, askOnce(retry));
          row.second = result.errors.length ? "FAIL" : "PASS";
        }
        row.orphans = result.warnings.length;
        const saved = readMotion(ctx.projectDir, ctx.protoId, "home").doc;
        row.note = result.errors.length ? result.errors[0].slice(0, 120) : `${saved?.tracks?.length || 0} track(s), ${saved?.duration} ms`;
      } catch (error) {
        row.note = String(/** @type {Error} */ (error).message || error).slice(0, 120);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
      rows.push(row);
      io.log(`${row.model} ${row.scenario}: first ${row.first}, retry ${row.second}, orphans ${row.orphans} - ${row.note}`);
    }
  }
  const pass = (/** @type {string} */ k) => rows.filter((r) => r[k] === "PASS").length;
  const md = [
    "| Model | Scenario | First try | After correction | Orphan tracks | Note |", "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.model} | ${r.scenario} | ${r.first} | ${r.second} | ${r.orphans} | ${String(r.note).replace(/\|/g, "/")} |`),
    "", `Valid on first try: ${pass("first")}/${rows.length}; valid after one correction: ${pass("first") + pass("second")}/${rows.length}.`,
  ].join("\n");
  io.log(`\n${md}`);
  if (opt("out", argv)) fs.writeFileSync(/** @type {string} */ (opt("out", argv)), `${md}\n`);
}

module.exports = { main, apply, buildPrompt, makeProject, SCENARIOS };
if (require.main === module) runAsScript(main);

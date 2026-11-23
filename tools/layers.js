#!/usr/bin/env node
// @ts-check
// Shows the effective skills, agents and workflows of a project and which layer each one comes from.
//   node tools/layers.js show <slug> [--kind skill|agent|workflow] [--json]
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { existingSlugs } = require("./lib/projects");
const { resolveLayers } = require("./lib/layers/resolve");
const { getDaiPath } = require("./lib/dai");

/** @param {string[]} argv @param {{ log: (m: string) => void }} [io] @param {{ daiPath?: string|null }} [options] */
function run(argv, io = console, options = {}) {
  const [cmd, slug] = argv.filter((a) => !a.startsWith("--") && a !== opt("kind", argv));
  if (cmd !== "show" || !slug) throw new CliError("Uso: node tools/layers.js show <slug> [--kind skill|agent|workflow] [--json]");
  if (!existingSlugs().includes(slug)) throw new CliError(`Projeto "${slug}" não existe em projects/.`);
  const kind = opt("kind", argv);
  const daiPath = options.daiPath !== undefined ? options.daiPath : getDaiPath();
  const { items, disabled } = resolveLayers(slug, { daiPath });
  const shown = kind ? items.filter((i) => i.kind === kind) : items;
  if (flag("json", argv)) return io.log(JSON.stringify({ items: shown, disabled }, null, 2));

  io.log(`Conjunto efetivo de ${slug} (dai > global > projeto; vence a camada mais específica)${daiPath ? "" : " [DAI não encontrado]"}`);
  for (const k of ["skill", "agent", "workflow"]) {
    const list = shown.filter((i) => i.kind === k);
    if (!list.length) continue;
    const by = (l) => list.filter((i) => i.layer === l).length;
    io.log(`\n${k}s: ${list.length} (dai ${by("dai")}, global ${by("global")}, projeto ${by("project")})`);
    for (const i of list.filter((x) => x.layer !== "dai" || x.overrides.length)) {
      io.log(`  ${i.layer.padEnd(8)} ${i.id}${i.overrides.length ? `  (substitui ${i.overrides.join(", ")})` : ""}`);
    }
  }
  if (disabled.length) io.log(`\nDesligados no project.json: ${disabled.map((d) => `${d.kind}:${d.id}`).join(", ")}`);
}

module.exports = { run };
if (require.main === module) runAsScript(run);

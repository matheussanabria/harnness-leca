#!/usr/bin/env node
// @ts-check
// Shows the effective skills, agents and workflows of a project and which layer each one comes from.
//   node tools/layers.js show <slug> [--kind skill|agent|workflow] [--json]
//   node tools/layers.js create <slug> <skill|agent|workflow> <id> [--description "..."]   (project layer only)
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { existingSlugs } = require("./lib/projects");
const { resolveLayers } = require("./lib/layers/resolve");
const { getDaiPath } = require("./lib/dai");
const { createItem } = require("./lib/layers/writer");

/** @param {string[]} argv @param {{ log: (m: string) => void }} [io] @param {{ daiPath?: string|null }} [options] */
function run(argv, io = console, options = {}) {
  const values = [opt("kind", argv), opt("description", argv)];
  const [cmd, slug, ckind, cid] = argv.filter((a) => !a.startsWith("--") && !values.includes(a));
  if (cmd === "create") {
    if (!slug || !ckind || !cid) throw new CliError("Uso: node tools/layers.js create <slug> <skill|agent|workflow> <id> [--description \"...\"]");
    if (!existingSlugs().includes(slug)) throw new CliError(`Projeto "${slug}" não existe em projects/.`);
    try {
      const r = createItem({ slug, kind: ckind, id: cid, description: opt("description", argv) || "" });
      return io.log(`Criado ${ckind} ${cid} na camada do projeto: ${r.dir} (${r.files.join(", ")})`);
    } catch (e) { throw new CliError(String(e && e.message || e)); }
  }
  if (cmd !== "show" || !slug) throw new CliError("Uso: node tools/layers.js show|create <slug> ...");
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

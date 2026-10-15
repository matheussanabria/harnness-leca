#!/usr/bin/env node
// Roda as rotinas de projects/<slug>/scheduled/ que venceram (ver tools/lib/routines.js).
//
//   node tools/run-scheduled.js                     todas as rotinas vencidas, de todos os projetos
//   node tools/run-scheduled.js --project dai       só um projeto
//   node tools/run-scheduled.js --now <arquivo>     roda uma rotina agora, mesmo fora do prazo (precisa de --project)
//   node tools/run-scheduled.js --list              mostra as rotinas, a última execução e a próxima
//   node tools/run-scheduled.js --dry-run           mostra o que rodaria, sem rodar
//   node tools/run-scheduled.js --log               além do terminal, acrescenta a saída em global/routines.log (use no agendador)
const fs = require("fs");
const path = require("path");
const { existingSlugs } = require("./lib/projects");
const routines = require("./lib/routines");
const { flag, opt } = require("./lib/cli");
const { ROOT } = require("./lib/root");

// Sob o Agendador de Tarefas não há terminal: com --log a saída também vai para um arquivo (local, fora do git).
if (flag("log")) {
  const logFile = path.join(ROOT, "global", "routines.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const original = console.log.bind(console);
  console.log = (...parts) => { original(...parts); try { fs.appendFileSync(logFile, `[${stamp}] ${parts.join(" ")}\n`); } catch { /* sem log, a rotina segue */ } };
  console.error = (...parts) => { console.log("ERRO:", ...parts); };
}

const fail = (m) => { console.error(m); process.exit(1); };
const only = opt("project");
const slugs = existingSlugs();
if (only && !slugs.includes(only)) fail(`Projeto "${only}" não existe em projects/. Existentes: ${slugs.join(", ")}`);
const now = opt("now");
if (flag("now") && (!only || !now || now.startsWith("--"))) fail("Uso: --project <slug> --now <arquivo-da-rotina>");
const targets = only ? [only] : slugs;
const fmt = (d) => d.toISOString().replace("T", " ").slice(0, 16) + "Z";

if (flag("list")) {
  for (const slug of targets) {
    const { routines: list, erros } = routines.listRoutines(slug);
    if (!list.length && !erros.length) continue;
    const states = routines.loadState(slug);
    console.log(`\n${slug}`);
    for (const r of list) {
      const st = states[r.arquivo];
      const proxima = r.ativa ? fmt(routines.dueAt(r, st, new Date())) : "desativada";
      console.log(`  ${r.arquivo.padEnd(34)} ${r.acao.padEnd(13)} a cada ${r.intervalo.padEnd(4)} última: ${st && st.ultima ? `${fmt(new Date(st.ultima))} ${st.status === "ok" ? "✔" : "✖"}` : "nunca"}  próxima: ${proxima}`);
    }
    for (const e of erros) console.log(`  ⚠ ${e.arquivo}: ${e.erro}`);
  }
  process.exit(0);
}

let failed = 0;
for (const slug of targets) {
  const { routines: list, erros } = routines.listRoutines(slug);
  if (!list.length && !erros.length) continue;
  console.log(slug);
  const r = routines.runProject(slug, { only: flag("now") ? now : undefined, dryRun: flag("dry-run"), log: console.log });
  failed += r.falhas.length;
}
process.exit(failed ? 1 : 0);

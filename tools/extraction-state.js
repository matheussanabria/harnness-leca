#!/usr/bin/env node
// Controla o que já foi analisado nas conversas de um projeto e detecta conversas que continuaram depois.
//
// Uso:
//   node tools/extraction-state.js --project <slug> status            resumo + lista do que está pendente
//   node tools/extraction-state.js --project <slug> pending [--limit N]   só os nomes dos .md pendentes (para agentes)
//   node tools/extraction-state.js --project <slug> mark --by gemini --file a.md --file b.md
//   node tools/extraction-state.js --project <slug> adopt [--by gemini]   marca como analisadas as conversas que já
//                                                                          têm seção em extraido-memorias.md
//   node tools/extraction-state.js --project <slug> reset             esquece tudo (reanalisa do zero)
//
// Uma conversa fica "alterada" quando o .md importado muda (mais turnos, título novo, etc.) depois de analisada.
// Rode o importador antes para trazer as conversas novas e as que continuaram.

const fs = require("fs");
const S = require("./lib/state");

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (n) => args.flatMap((a, i) => (a === `--${n}` ? [args[i + 1]] : []));
const slug = opt("project");
const cmd = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--")) || "status";

const fail = (m) => { console.error(m); process.exit(1); };
let p;
try { p = S.paths(slug); } catch { fail("Uso: node tools/extraction-state.js --project <slug> status|pending|mark|adopt|reset"); }
if (!fs.existsSync(p.chats)) fail(`Sem chats em projects/${slug}/chats. Rode o importador primeiro.`);

const rows = S.scan(slug);
const pending = rows.filter((r) => r.status !== "ok");

if (cmd === "status") {
  const n = (s) => rows.filter((r) => r.status === s).length;
  console.log(`${slug}: ${rows.length} conversas | ${n("ok")} em dia | ${n("nova")} novas | ${n("alterada")} alteradas\n`);
  for (const r of pending) {
    const extra = r.status === "alterada" ? `  (${r.antes.turnos} → ${r.turnos} turnos; analisada em ${r.antes.analisadoEm.slice(0, 10)} por ${r.antes.por})` : `  (${r.turnos} turnos)`;
    console.log(`${r.status.padEnd(8)} ${r.name}${extra}`);
  }
  if (!pending.length) console.log("Tudo em dia.");
} else if (cmd === "pending") {
  const lim = opt("limit") ? Math.max(1, parseInt(opt("limit"), 10) || 1) : Infinity;
  pending.slice(0, lim).forEach((r) => console.log(r.name));
} else if (cmd === "mark") {
  const files = all("file");
  if (!files.length) fail("Informe ao menos um --file nome.md");
  try { S.mark(slug, files, opt("by")).forEach((f) => console.log(`marcada: ${f}`)); } catch (e) { fail(e.message); }
} else if (cmd === "adopt") {
  // Para quem já extraiu antes de existir o controle: casa os títulos de extraido-memorias.md com as conversas.
  if (!fs.existsSync(p.memorias)) fail("Não há extraido-memorias.md neste projeto.");
  const mem = fs.readFileSync(p.memorias, "utf8");
  const headings = new Set([...mem.matchAll(/^## (.+?) \((\d{4}-\d\d-\d\d|s\/d)\)\s*$/gm)].map((m) => `${m[1].trim().toLowerCase()}|${m[2]}`));
  const hits = rows.filter((r) => headings.has(`${r.titulo.trim().toLowerCase()}|${r.data || "s/d"}`)).map((r) => r.name);
  if (hits.length) S.mark(slug, hits, opt("by") || "adotada");
  console.log(`${hits.length} conversa(s) adotada(s) como já analisadas.`);
  hits.forEach((f) => console.log(`  ${f}`));
} else if (cmd === "reset") {
  S.save(slug, { version: 1, sessoes: {} });
  console.log("Estado zerado.");
} else fail(`Comando desconhecido: ${cmd}`);

#!/usr/bin/env node
// Consolida as sugestões de memória de um projeto com um modelo: junta as repetidas e descarta o passageiro, para você
// revisar poucas dezenas de itens em vez de milhares (ver tools/lib/consolidate.js). Só gera SUGESTÕES: nada vai para a
// memory.md sem a sua revisão na interface.
//
//   node tools/consolidate-memory.js --project dai [--engine opencode|claude] [--model opencode/<modelo>-free]
//                                    [--categoria regra,decisao,termo,memoria] [--lote 120] [--max 25] [--dry-run] [--allow-paid]
//   --max N: depois de juntar as repetidas, o modelo escolhe as N mais importantes de cada categoria (o resto fica de fora; --desfazer traz de volta)
//   node tools/consolidate-memory.js --project dai --desfazer      traz de volta as sugestões originais
const consolidate = require("./lib/consolidate");
const { ask } = require("./lib/llm");
const { existingSlugs } = require("./lib/projects");
const { flag, opt } = require("./lib/cli");

const fail = (m) => { console.error(m); process.exit(1); };
const slug = opt("project");
if (!slug || !existingSlugs().includes(slug)) fail(`Uso: node tools/consolidate-memory.js --project <slug> [--engine opencode|claude] [--model nome] [--categoria ...] [--lote N] [--max N] [--dry-run] [--desfazer]\nProjetos: ${existingSlugs().join(", ")}`);

if (flag("desfazer")) {
  const r = consolidate.undoConsolidation(slug);
  console.log(`${r.restored} sugestão(ões) original(is) voltaram para a revisão${r.arquivoRemovido ? "; memorias-consolidadas.md removido" : ""}.`);
  process.exit(0);
}

const engine = opt("engine") || "opencode";
if (!["claude", "opencode"].includes(engine)) fail("--engine inválido (use claude ou opencode).");
const model = opt("model");
if (model && !/^[\w.\-\/]+$/.test(model)) fail("--model inválido (use só letras, números, ponto, _, - e /).");
const valid = ["memoria", "regra", "decisao", "termo"];
const categorias = opt("categoria") ? opt("categoria").split(",").map((s) => s.trim()) : undefined;
if (categorias && categorias.some((c) => !valid.includes(c))) fail(`--categoria inválida. Use: ${valid.join(", ")}`);
const lote = opt("lote") ? Number(opt("lote")) : undefined;
if (lote !== undefined && (!Number.isInteger(lote) || lote < 10 || lote > 400)) fail("--lote deve ser um número de 10 a 400.");

const max = opt("max") ? Number(opt("max")) : undefined;
if (max !== undefined && (!Number.isInteger(max) || max < 3 || max > 300)) fail("--max deve ser um número de 3 a 300 (itens por categoria).");

console.log(`Consolidando as sugestões de ${slug} com ${engine}${model ? ` (${model})` : ""}${flag("dry-run") ? " [dry-run: nada será gravado]" : ""}...`);
try {
  const { stats, total } = consolidate.consolidateProject(slug, {
    ask: (prompt) => ask({ engine, model, prompt, allowPaid: flag("allow-paid") }),
    categorias, batchSize: lote, max, dryRun: flag("dry-run"), log: console.log,
  });
  if (!total) { console.log("Nada a consolidar: não há sugestões originais pendentes."); process.exit(0); }
  const sum = (k) => Object.values(stats).reduce((a, s) => a + s[k], 0);
  console.log(`\n${sum("originais")} sugestões → ${sum("consolidadas")} consolidadas (${sum("semReferencia")} deixadas de fora pelo modelo).`);
  console.log(flag("dry-run") ? "[dry-run] nada foi gravado." : "As consolidadas estão em context/memorias-consolidadas.md e na revisão da interface; as originais ficaram escondidas (--desfazer traz de volta).");
} catch (e) {
  fail(`Falhou: ${e.message}. Nada foi gravado para a categoria em andamento; as já concluídas antes ficaram registradas.`);
}

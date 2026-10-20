#!/usr/bin/env node
// @ts-check
// CLI para ler conversas de um projeto e sugerir grupos e subgrupos de contexto automaticamente.
// Uso:
//   node tools/suggest-groups.js --project saude-dispensacao
//   node tools/suggest-groups.js --project saude-dispensacao --apply
//   node tools/suggest-groups.js --all --apply

const path = require("path");
const fs = require("fs");
const { ROOT } = require("./lib/root");
const { classifyProject, applyGroupSuggestions } = require("./lib/suggest");

function getActiveProject() {
  try {
    const activeFile = path.join(ROOT, "projects", ".active");
    if (fs.existsSync(activeFile)) {
      const lines = fs.readFileSync(activeFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return lines.pop() || "";
    }
  } catch {}
  return "";
}

function parseArgs(args) {
  let project = "";
  let apply = false;
  let all = false;
  let limit = 0;
  let llm = false;
  let model = "";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project" || a === "-p") {
      project = args[++i] || "";
    } else if (a === "--apply") {
      apply = true;
    } else if (a === "--all") {
      all = true;
    } else if (a === "--llm") {
      llm = true;
    } else if (a === "--model") {
      model = args[++i] || "";
    } else if (a === "--limit") {
      limit = Number(args[++i]) || 0;
    } else if (a === "--help" || a === "-h") {
      console.log(`
Uso: node tools/suggest-groups.js [opções]

Opções:
  -p, --project <slug>   Projeto alvo (padrão: projeto ativo em projects/.active)
  --apply                Aplica as sugestões diretamente em projects/<slug>/groups.json
  --all                  Analisa todas as conversas (inclusive as já categorizadas)
  --limit <n>            Limita a quantidade de conversas a analisar
  --llm                  Confirma os temas com um modelo gratuito do opencode (mais lento, ~10 s por conversa;
                         o resultado fica em cache em projects/<slug>/.suggest-llm.json)
  --model <provedor/m>   Modelo do opencode para --llm (padrão: o modelo gratuito do harness)
  -h, --help             Exibe esta ajuda
`);
      process.exit(0);
    }
  }

  if (!project) project = getActiveProject();
  return { project, apply, all, limit, llm, model };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.project) {
    console.error("Erro: Nenhum projeto informado e nenhum projeto ativo em projects/.active.");
    process.exit(1);
  }

  const projDir = path.join(ROOT, "projects", opts.project);
  if (!fs.existsSync(projDir)) {
    console.error(`Erro: Projeto "${opts.project}" não encontrado em projects/`);
    process.exit(1);
  }

  console.log(`\n🔍 Analisando conversas do projeto: \x1b[1m${opts.project}\x1b[0m...`);
  const report = await classifyProject(opts.project, { all: opts.all, llm: opts.llm, model: opts.model || undefined });

  if (report.llmFailed) console.log(`⚠️  O modelo falhou em ${report.llmFailed} conversa(s): elas ficaram só com o método local.`);
  console.log(`Total de chats: ${report.total} | Já categorizados: ${report.classified} | A analisar: ${report.pending}\n`);

  if (!report.suggestions.length) {
    console.log("✨ Todas as conversas já possuem grupos atribuídos! (Use --all para reclassificar todas)");
    return;
  }

  const items = opts.limit > 0 ? report.suggestions.slice(0, opts.limit) : report.suggestions;

  console.log("--------------------------------------------------------------------------------");
  console.log("SUGESTÕES DE CATEGORIZAÇÃO:");
  console.log("--------------------------------------------------------------------------------");

  const toApply = [];
  for (const s of items) {
    const sug = s.suggestion;
    const subStr = sug.subgroup ? ` › \x1b[36m${sug.subgroup}\x1b[0m` : "";
    const conf = Math.round(sug.confidence * 100);

    console.log(`📄 \x1b[1m${s.title.slice(0, 55)}\x1b[0m`);
    console.log(`   Arquivo: ${s.file}`);
    console.log(`   Grupo Sugerido: \x1b[33m${sug.group}\x1b[0m${subStr} (${conf}% de confiança)`);
    console.log(`   Motivo: ${sug.reason}${sug.verified ? " [confirmado pelo modelo]" : ""}`);
    console.log("");

    toApply.push({
      file: s.file,
      group: sug.group,
      subgroup: sug.subgroup,
      color: sug.color,
    });
  }

  if (opts.apply) {
    applyGroupSuggestions(opts.project, toApply);
    console.log(`✅ \x1b[32m${toApply.length} conversas categorizadas com sucesso em projects/${opts.project}/groups.json!\x1b[0m\n`);
  } else {
    console.log("--------------------------------------------------------------------------------");
    console.log("ℹ️  Modo visualização (--dry-run). Nenhuma alteração foi gravada em disco.");
    console.log(`👉 Para aplicar estas sugestões, execute:`);
    console.log(`   \x1b[1mnode tools/suggest-groups.js --project ${opts.project} --apply\x1b[0m\n`);
  }
}

main().catch((err) => {
  console.error("Falha ao sugerir grupos:", err);
  process.exit(1);
});

#!/usr/bin/env node
// @ts-check
// Exporta a memória curada do Harness Leca para o contexto nativo dos agentes:
// 1. Claude Code: ~/.claude/projects/<pasta>/memory/MEMORY.md (só o bloco gerenciado)
// 2. Gemini / Antigravity: Knowledge Item (memory.md) + regra global em ~/.gemini
// 3. Pastas locais: .claude/context/ e .gemini/context/ no próprio harness-leca
//
// Uso:
//   node tools/export-context.js                    sincroniza todos os projetos
//   node tools/export-context.js --project <slug>   sincroniza um projeto específico
//   node tools/export-context.js --dry-run          simula sem gravar nada
//   node tools/export-context.js --report           mostra bytes e tokens (bytes/4) por projeto e destino
//   node tools/export-context.js --prune [--yes]    lista arquivos antigos; só remove com --yes
//
// Destinos podem ser trocados por parâmetro (options) ou pelas variáveis
// HARNESS_EXPORT_CLAUDE_PROJECTSe HARNESS_EXPORT_GEMINI_HOME.

const fs = require("fs");

const { existingSlugs, matchers, projectFromPath } = require("./lib/projects");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { collectProjectData, resolveTargets } = require("./lib/export/data");
const { writeManagedBlock, writeGenerated, isInside } = require("./lib/export/managed-file");
const { planClaude } = require("./lib/export/claude");
const { planGeminiProject, planGeminiGlobal } = require("./lib/export/gemini");
const { reportRows, printReport, prune } = require("./lib/export/housekeeping");

/** Mapeia pastas do Claude Code existentes em claudeProjectsDir por slug de projeto. */
function mapClaudeDirs(claudeProjectsDir, ms) {
  const bySlug = new Map();
  if (!fs.existsSync(claudeProjectsDir)) return bySlug;
  for (const d of fs.readdirSync(claudeProjectsDir, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const slug = projectFromPath(d.name, ms);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(d.name);
  }
  return bySlug;
}

/** Aplica uma escrita planejada respeitando o tipo (bloco gerenciado ou arquivo gerado). */
function apply(w, dryRun, io) {
  if (!isInside(w.root, w.file)) {
    io.log(`   [aviso] destino fora da pasta permitida, ignorado: ${w.file}`);
    return { file: w.file, dest: w.dest, status: "skipped", bytes: 0 };
  }
  const opts = { dryRun, log: (m) => io.log(m), legacy: w.legacy };
  const r = w.kind === "managed" ? writeManagedBlock(w.file, w.content, opts) : writeGenerated(w.file, w.content, opts);
  return { ...r, dest: w.dest };
}

/**
 * @param {string[]} argv
 * @param {{ log: (m: string) => void }} [io]
 * @param {{ claudeProjectsDir?: string, geminiHome?: string }} [options] destinos injetados
 */
function run(argv, io = console, options = {}) {
  const dryRun = flag("dry-run", argv);
  const targetProject = opt("project", argv);
  const today = new Date().toISOString().slice(0, 10);
  const targets = resolveTargets(options);

  const slugs = existingSlugs();
  if (targetProject && !slugs.includes(targetProject)) {
    throw new CliError(`Projeto "${targetProject}" não encontrado. Projetos disponíveis: ${slugs.join(", ")}`);
  }
  const projectsToSync = targetProject ? [targetProject] : slugs;
  const claudeDirsBySlug = mapClaudeDirs(targets.claudeProjectsDir, matchers());

  io.log(`\n======================================================`);
  io.log(` Sincronizando contexto do Harness Leca -> Claude & Gemini`);
  io.log(` Data: ${today} ${dryRun ? "[MODO SIMULACAO - DRY RUN]" : ""}`);
  io.log(`======================================================\n`);

  let totalClaudeFolders = 0;
  let totalGeminiKIs = 0;
  const overview = [];
  const allLegacy = [];
  const rows = [];

  for (const slug of projectsToSync) {
    const data = collectProjectData(slug);
    io.log(`Processando projeto: ${slug} (${data.chatsCount} conversas salvas)`);

    const claude = planClaude(data, claudeDirsBySlug.get(slug) || [], targets);
    const gemini = planGeminiProject(data, targets);
    // As copias locais em .claude/context e .gemini/context nao tinham leitor e deixaram de ser geradas.
    const plan = [...claude.writes, ...gemini.writes];
    const legacy = [...claude.legacy, ...gemini.legacy];

    const results = plan.map((w) => apply(w, dryRun, io));
    allLegacy.push(...legacy);
    rows.push(...reportRows(slug, results, legacy));

    totalClaudeFolders += claude.folders;
    totalGeminiKIs++;
    io.log(`   [Claude] ${claude.folders} pasta(s) com bloco gerenciado em MEMORY.md`);
    io.log(`   [Gemini] Knowledge Item: ki-projeto-${slug}`);
    overview.push({ slug, chatsCount: data.chatsCount });
  }

  const globalRule = apply(planGeminiGlobal(overview, targets, today), dryRun, io);
  io.log(`\n   [Gemini Global Rule] harness-projects-overview.md (${globalRule.status})`);

  io.log(`\nConcluido.`);
  io.log(`  - Pastas do Claude Code sincronizadas: ${totalClaudeFolders}`);
  io.log(`  - Knowledge Items do Gemini: ${totalGeminiKIs}`);

  if (flag("report", argv)) printReport(rows, io);
  if (flag("prune", argv)) prune(allLegacy, { confirmed: flag("yes", argv), dryRun }, io);
}

module.exports = { run };
if (require.main === module) runAsScript(run);

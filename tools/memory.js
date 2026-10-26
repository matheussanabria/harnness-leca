#!/usr/bin/env node
// @ts-check
// CLI de gestão da memória declarativa dos agentes (EP-13.03).
// Subcomando index: monta memory.md a partir dos itens; --check confere integridade.
const fs = require("fs");
const path = require("path");
const { opt, flag, CliError, runAsScript } = require("./lib/cli");
const { resolveMemoryDir, listItems } = require("./lib/memory/store");
const { render } = require("./lib/memory/index");

function runIndex(argv, io = console, baseDir) {
  const rootDir = baseDir || path.resolve(__dirname, "..");
  const project = opt("project", argv);
  const checkOnly = flag("check", argv);
  const allProjects = flag("all", argv);

  /** @type {string[]} */
  const slugs = [];
  if (allProjects) {
    slugs.push("global");
    const pDir = path.join(rootDir, "projects");
    if (fs.existsSync(pDir)) {
      for (const e of fs.readdirSync(pDir, { withFileTypes: true })) {
        if (e.isDirectory()) slugs.push(e.name);
      }
    }
  } else if (project) {
    slugs.push(project);
  } else {
    // Tenta ler projects/.active
    const activePath = path.join(rootDir, "projects", ".active");
    if (fs.existsSync(activePath)) {
      const line = fs.readFileSync(activePath, "utf8").trim().split(/\r?\n/).pop()?.trim();
      if (line) slugs.push(line);
      else slugs.push("global");
    } else {
      slugs.push("global");
    }
  }

  let totalUpdated = 0;
  let hasDrift = false;

  for (const slug of slugs) {
    const memDir = resolveMemoryDir(rootDir, slug);
    if (!fs.existsSync(memDir)) {
      // Se a pasta memory/ não existe para este projeto, ignora sem erro (RF6)
      continue;
    }

    const { valid, invalid } = listItems(memDir);
    if (invalid.length > 0) {
      for (const err of invalid) {
        io.error(`[${slug}] Item inválido ignorado: ${err.relPath} (${err.errors.map((e) => e.mensagem).join("; ")})`);
      }
    }

    const scopeTitle = slug === "global" ? "Memória global" : `Memória do projeto ${slug}`;
    const targetFile = slug === "global"
      ? path.join(rootDir, "global", "memory.md")
      : path.join(rootDir, "projects", slug, "memory.md");

    // Mantém a data existente se for check para evitar drift apenas de timestamp
    let today;
    if (checkOnly && fs.existsSync(targetFile)) {
      const match = fs.readFileSync(targetFile, "utf8").match(/tools\/memory\.js index em (\d{4}-\d{2}-\d{2})\./);
      if (match) today = match[1];
    }

    const result = render(valid, { scopeTitle, today });

    if (result.overLimit) {
      io.error(`[${slug}] ERRO: Teto de 150 linhas estourado (${result.linesCount} linhas).`);
      io.error("Candidatos mais antigos do tipo 'project' para arquivar:");
      for (const cand of result.archiveCandidates.slice(0, 5)) {
        io.error(`  - ${cand.name} (criado em ${cand.created}): ${cand.relPath}`);
      }
      throw new CliError(`Teto de linhas estourado no índice de ${slug}`, 2);
    }

    const existingContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, "utf8") : "";

    if (checkOnly) {
      if (existingContent.replace(/\r\n/g, "\n") !== result.content.replace(/\r\n/g, "\n")) {
        io.error(`[${slug}] Índice desatualizado: ${targetFile}`);
        hasDrift = true;
      }
    } else {
      fs.writeFileSync(targetFile, result.content, "utf8");
      io.log(`[${slug}] Índice atualizado: ${targetFile} (${result.linesCount} linhas, ${valid.length} itens)`);
      totalUpdated++;
    }
  }

  if (checkOnly && hasDrift) {
    throw new CliError("Índice de memória desatualizado. Execute 'node tools/memory.js index'.", 1);
  }
}

function main(argv, io = console) {
  const subcmd = argv[0];
  if (!subcmd || subcmd === "--help" || subcmd === "-h") {
    io.log("Uso: node tools/memory.js <subcomando> [opções]");
    io.log("Subcomandos disponíveis:");
    io.log("  index [--project <slug> | --all] [--check]   Gera ou verifica o índice memory.md");
    return;
  }

  if (subcmd === "index") {
    runIndex(argv.slice(1), io);
  } else {
    throw new CliError(`Subcomando desconhecido: ${subcmd}. Use --help.`);
  }
}

module.exports = { main, runIndex };
if (require.main === module) runAsScript(main);

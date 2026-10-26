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

function runMigrate(argv, io = console, baseDir) {
  const rootDir = baseDir || path.resolve(__dirname, "..");
  const project = opt("project", argv);
  const dryRun = flag("dry-run", argv);

  if (!project) {
    throw new CliError("Uso: node tools/memory.js migrate --project <slug> [--dry-run]");
  }

  const { parseBullets, deduplicateBullets } = require("./lib/memory/migrate");
  const { serializeItem } = require("./lib/memory/item");

  const legacyFile = project === "global"
    ? path.join(rootDir, "global", "memory.md")
    : path.join(rootDir, "projects", project, "memory.md");

  if (!fs.existsSync(legacyFile)) {
    throw new CliError(`Arquivo de memória não encontrado: ${legacyFile}`);
  }

  const raw = fs.readFileSync(legacyFile, "utf8");
  const bullets = parseBullets(raw);
  if (bullets.length === 0) {
    io.log(`[${project}] Nenhum bullet para migrar.`);
    return;
  }

  const deduplicated = deduplicateBullets(bullets);
  io.log(`[${project}] Migrando ${bullets.length} bullets para ${deduplicated.length} itens atômicos:`);

  const memDir = resolveMemoryDir(rootDir, project);

  for (const item of deduplicated) {
    const destRel = path.join(item.type, `${item.name}.md`).replace(/\\/g, "/");
    const dupNotice = item.duplicatesCount > 0 ? ` (agrupou ${item.duplicatesCount + 1} duplicatas)` : "";
    io.log(`  - [${item.type}] ${item.name} -> memory/${destRel}${dupNotice}`);

    if (!dryRun) {
      const typeDir = path.join(memDir, item.type);
      fs.mkdirSync(typeDir, { recursive: true });
      const destFile = path.join(typeDir, `${item.name}.md`);

      let body = "";
      if (item.type === "feedback" || item.type === "project") {
        body = "**Why:**\n(a preencher na revisão)\n\n**How to apply:**\n(a preencher na revisão)\n";
      }

      const content = serializeItem({
        name: item.name,
        description: item.description,
        type: item.type,
        created: item.created,
        updated: item.updated,
        source: "migrate:memory.md",
      }, body);

      fs.writeFileSync(destFile, content, "utf8");
    }
  }

  if (dryRun) {
    io.log(`[${project}] Modo dry-run: nenhum arquivo foi gravado.`);
  } else {
    // Faz backup do original para memory.legacy.md (RF5)
    const backupFile = project === "global"
      ? path.join(rootDir, "global", "memory.legacy.md")
      : path.join(rootDir, "projects", project, "memory.legacy.md");
    fs.copyFileSync(legacyFile, backupFile);
    io.log(`[${project}] Backup original salvo em: ${backupFile}`);

    // Regenera o índice memory.md
    runIndex(["--project", project], io, rootDir);
  }
}

function main(argv, io = console) {
  const subcmd = argv[0];
  if (!subcmd || subcmd === "--help" || subcmd === "-h") {
    io.log("Uso: node tools/memory.js <subcomando> [opções]");
    io.log("Subcomandos disponíveis:");
    io.log("  index [--project <slug> | --all] [--check]     Gera ou verifica o índice memory.md");
    io.log("  migrate --project <slug> [--dry-run]          Migra bullets antigos para itens atômicos");
    return;
  }

  if (subcmd === "index") {
    runIndex(argv.slice(1), io);
  } else if (subcmd === "migrate") {
    runMigrate(argv.slice(1), io);
  } else {
    throw new CliError(`Subcomando desconhecido: ${subcmd}. Use --help.`);
  }
}

module.exports = { main, runIndex, runMigrate };
if (require.main === module) runAsScript(main);

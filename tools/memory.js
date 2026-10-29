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

function runSave(argv, io = console, baseDir) {
  const rootDir = baseDir || path.resolve(__dirname, "..");
  const scope = opt("scope", argv) || "project";
  const project = opt("project", argv) || (scope === "global" ? "global" : "");
  const type = /** @type {import("./lib/memory/item").TipoItem} */ (opt("type", argv));
  const name = opt("name", argv);
  const description = opt("description", argv);
  const bodyText = opt("body", argv);
  const bodyFile = opt("body-file", argv);
  const source = opt("source", argv);
  const update = opt("update", argv);
  const forceNew = flag("force-new", argv);
  const asJson = flag("json", argv);

  if (!project || !type || !name || !description || (!bodyText && !bodyFile)) {
    throw new CliError("Uso: node tools/memory.js save [--scope project|global] --project <slug> --type <t> --name <n> --description <d> (--body <texto> | --body-file <f>) [--source <s>] [--update <nome>] [--force-new] [--json]");
  }

  const { inspectSecrets } = require("./lib/memory/guard");
  const { saveItem, resolveMemoryDir } = require("./lib/memory/store");

  let body = bodyText || "";
  if (bodyFile) {
    const fullPath = path.resolve(rootDir, bodyFile);
    if (!fs.existsSync(fullPath)) {
      throw new CliError(`Arquivo de corpo não encontrado: ${bodyFile}`);
    }
    body = fs.readFileSync(fullPath, "utf8");
  }

  // RF3: Inspeciona segredos (recusa com código 3 sem ecoar o valor)
  const secrets = inspectSecrets(description, body);
  if (secrets.length > 0) {
    const reason = `segredo recusado: ${secrets.join(", ")}`;
    if (asJson) {
      io.log(JSON.stringify({ status: "recusado", reason, violations: secrets }));
    } else {
      io.error(`recusado ${reason}`);
    }
    throw new CliError(`Gravação de memória recusada por violação de segurança: ${secrets.join(", ")}`, 3);
  }

  const memDir = resolveMemoryDir(rootDir, project);
  const result = saveItem(memDir, { name, description, type, body, source }, { update, forceNew });

  if (result.status !== "recusado") {
    // Regenera o índice automaticamente após gravação (RF4)
    runIndex(["--project", project], { log: () => {}, error: () => {} }, rootDir);
  }

  if (asJson) {
    io.log(JSON.stringify(result));
  } else {
    // Saída em uma linha legível por agente (RF5)
    io.log(`${result.status} ${result.path || name} ${result.reason}`);
  }

  if (result.status === "recusado") {
    throw new CliError(`Não foi possível salvar o item: ${result.reason}`, 2);
  }
}

function runHarvest(argv, io = console, baseDir) {
  const rootDir = baseDir || path.resolve(__dirname, "..");
  const project = opt("project", argv);
  const engine = /** @type {"claude" | "gemini" | "all"} */ (opt("engine", argv) || "all");
  const dryRun = flag("dry-run", argv);

  const { harvestAll } = require("./lib/memory/harvest/index");
  const results = harvestAll({
    project,
    engine,
    dryRun,
    rootDir,
    io,
  });

  const totalProjects = Object.keys(results).length;
  const totalItems = Object.values(results).reduce((acc, items) => acc + items.length, 0);
  io.log(`Colheita finalizada: ${totalItems} memória(s) em ${totalProjects} projeto(s).`);
}

function runLintCmd(argv, io = console, baseDir) {
  const { runLint } = require("./lib/memory/run-lint");
  runLint(argv, io, baseDir);
}

function main(argv, io = console) {
  const subcmd = argv[0];
  if (!subcmd || subcmd === "--help" || subcmd === "-h") {
    io.log("Uso: node tools/memory.js <subcomando> [opções]");
    io.log("Subcomandos disponíveis:");
    io.log("  index [--project <slug> | --all] [--check]     Gera ou verifica o índice memory.md");
    io.log("  migrate --project <slug> [--dry-run]          Migra bullets antigos para itens atômicos");
    io.log("  save [opções]                                 Salva ou atualiza item atômico com verificação");
    io.log("  harvest [--project <slug>] [--engine e]       Colhe memórias nativas de Claude e Gemini");
    io.log("  lint [--project <slug> | --all] [--json]      Verifica qualidade, caminhos e regras de memória");
    return;
  }

  if (subcmd === "index") {
    runIndex(argv.slice(1), io);
  } else if (subcmd === "migrate") {
    runMigrate(argv.slice(1), io);
  } else if (subcmd === "save") {
    runSave(argv.slice(1), io);
  } else if (subcmd === "harvest") {
    runHarvest(argv.slice(1), io);
  } else if (subcmd === "lint") {
    runLintCmd(argv.slice(1), io);
  } else {
    throw new CliError(`Subcomando desconhecido: ${subcmd}. Use --help.`);
  }
}

module.exports = { main, runIndex, runMigrate, runSave, runHarvest, runLintCmd };
if (require.main === module) runAsScript(main);


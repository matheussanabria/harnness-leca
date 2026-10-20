#!/usr/bin/env node
// @ts-check
// Exporta e sincroniza as memórias, regras e histórico de conversas do Harness Leca
// diretamente para o contexto nativo dos agentes:
// 1. Claude Code: ~/.claude/projects/<pasta>/memory/ (MEMORY.md + tópicos)
// 2. Gemini / Antigravity: ~/.gemini/antigravity-ide/knowledge/ki-projeto-<slug>/ + ~/.gemini/config/rules/
// 3. Pastas locais: .claude/context/ e .gemini/context/ no próprio harness-leca
//
// Uso:
//   node tools/export-context.js                    sincroniza todos os projetos
//   node tools/export-context.js --project <slug>   sincroniza um projeto específico
//   node tools/export-context.js --dry-run          simula sem gravar nada

const fs = require("fs");
const os = require("os");
const path = require("path");

const { ROOT } = require("./lib/root");
const { existingSlugs, matchers, projectFromPath } = require("./lib/projects");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");

const HOME = os.homedir();
const CLAUDE_PROJECTS_DIR = path.join(HOME, ".claude", "projects");
const GEMINI_KNOWLEDGE_DIR = path.join(HOME, ".gemini", "antigravity-ide", "knowledge");
const GEMINI_RULES_DIR = path.join(HOME, ".gemini", "config", "rules");
const LOCAL_CLAUDE_CTX = path.join(ROOT, ".claude", "context");
const LOCAL_GEMINI_CTX = path.join(ROOT, ".gemini", "context");

function readFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
    }
  } catch {}
  return "";
}

function countChats(chatsDir) {
  try {
    if (fs.existsSync(chatsDir)) {
      return fs.readdirSync(chatsDir).filter((f) => f.endsWith(".md")).length;
    }
  } catch {}
  return 0;
}

function collectProjectData(slug) {
  const projDir = path.join(ROOT, "projects", slug);
  const memoryMd = readFileSafe(path.join(projDir, "memory.md"));
  const instructionsMd = readFileSafe(path.join(projDir, "instructions.md"));

  const ctxDir = path.join(projDir, "context");
  const memoriasConsolidadas = readFileSafe(path.join(ctxDir, "memorias-consolidadas.md"));
  const extraidoMemorias = readFileSafe(path.join(ctxDir, "extraido-memorias.md"));
  const extraidoRegras = readFileSafe(path.join(ctxDir, "extraido-regras.md"));
  const extraidoConversas = readFileSafe(path.join(ctxDir, "extraido-conversas.md"));

  const chatsDir = path.join(projDir, "chats");
  const chatsCount = countChats(chatsDir);

  return {
    slug,
    memoryMd,
    instructionsMd,
    memoriasConsolidadas: memoriasConsolidadas || extraidoMemorias,
    extraidoRegras,
    extraidoConversas,
    chatsCount,
  };
}

function generateClaudeMemory(data, today) {
  const memoryLines = data.memoryMd
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- [") || (l.startsWith("-") && !l.startsWith("<!--")));

  const highlights = memoryLines.length
    ? memoryLines.slice(0, 35).join("\n")
    : "- Nenhuma memória formal gravada ainda.";

  return `# Memória do Projeto: ${data.slug}
<!-- Sincronizado do Harness Leca em ${today} - Total de conversas preservadas: ${data.chatsCount} -->

## Decisões e Fatos Principais
${highlights}

## Tópicos Detalhados
- [Regras e Diretrizes do Projeto](regras-e-diretrizes.md)
- [Memórias e Conhecimento Consolidado](memorias-consolidadas.md)
- [Histórico e Índice de Conversas](historico-conversas.md)
`;
}

function ensureDir(dirPath, dryRun) {
  if (!dryRun && !fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content, dryRun) {
  if (!dryRun) {
    ensureDir(path.dirname(filePath), false);
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function run(argv, io = console) {
  const dryRun = flag("dry-run", argv);
  const targetProject = opt("project", argv);
  const today = new Date().toISOString().slice(0, 10);

  const slugs = existingSlugs();
  if (targetProject && !slugs.includes(targetProject)) {
    throw new CliError(`Projeto "${targetProject}" não encontrado. Projetos disponíveis: ${slugs.join(", ")}`);
  }

  const projectsToSync = targetProject ? [targetProject] : slugs;
  const ms = matchers();

  io.log(`\n======================================================`);
  io.log(` Sincronizando contexto do Harness Leca -> Claude & Gemini`);
  io.log(` Data: ${today} ${dryRun ? "[MODO SIMULAÇÃO - DRY RUN]" : ""}`);
  io.log(`======================================================\n`);

  // Mapeia diretórios do Claude Code existentes em ~/.claude/projects
  const claudeDirsBySlug = new Map();
  if (fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    for (const d of fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true }).filter((x) => x.isDirectory())) {
      const slug = projectFromPath(d.name, ms);
      if (slug) {
        if (!claudeDirsBySlug.has(slug)) claudeDirsBySlug.set(slug, []);
        claudeDirsBySlug.get(slug).push(d.name);
      }
    }
  }

  // Prepara pastas padrão caso não existam no ~/.claude/projects
  const knownGitMappings = {
    "57multimarcas": "c--Users-matheuss-rodrigues-git-57multimarcas",
    "saude-dispensacao": "c--Users-matheuss-rodrigues-git-saude-dispensacao",
    "saude-prontuario": "c--Users-matheuss-rodrigues-git-saude-prontuario",
    "conversor-relatorio-maquininhas": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas",
    "conversor-relatorio-maquininhas-meu": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas-meu",
    "dai": "c--Users-matheuss-rodrigues-git-DAI",
  };

  let totalClaudeFolders = 0;
  let totalGeminiKIs = 0;
  const overviewList = [];

  for (const slug of projectsToSync) {
    const data = collectProjectData(slug);
    io.log(`📦 Processando projeto: ${slug} (${data.chatsCount} conversas salvas)`);

    // -----------------------------------------------------------------
    // 1. CLAUDE CODE: ~/.claude/projects/<dir>/memory/
    // -----------------------------------------------------------------
    let claudeDirs = claudeDirsBySlug.get(slug) || [];
    if (!claudeDirs.length && knownGitMappings[slug]) {
      claudeDirs = [knownGitMappings[slug]];
    }

    const claudeMemoryContent = generateClaudeMemory(data, today);
    for (const cDir of claudeDirs) {
      const memoryDir = path.join(CLAUDE_PROJECTS_DIR, cDir, "memory");
      writeFile(path.join(memoryDir, "MEMORY.md"), claudeMemoryContent, dryRun);

      if (data.extraidoRegras) {
        writeFile(path.join(memoryDir, "regras-e-diretrizes.md"), `# Regras e Diretrizes: ${slug}\n\n${data.extraidoRegras}`, dryRun);
      }
      if (data.memoriasConsolidadas) {
        writeFile(path.join(memoryDir, "memorias-consolidadas.md"), `# Memórias Consolidadas: ${slug}\n\n${data.memoriasConsolidadas}`, dryRun);
      }
      if (data.extraidoConversas) {
        writeFile(path.join(memoryDir, "historico-conversas.md"), `# Índice de Conversas Salvas: ${slug}\n\n${data.extraidoConversas}`, dryRun);
      }
      totalClaudeFolders++;
      io.log(`   [Claude] -> ~/.claude/projects/${cDir}/memory/ (MEMORY.md + tópicos)`);
    }

    // -----------------------------------------------------------------
    // 2. GEMINI / ANTIGRAVITY: Knowledge Item em ~/.gemini/antigravity-ide/knowledge/
    // -----------------------------------------------------------------
    const kiSlug = `ki-projeto-${slug}`;
    const kiDir = path.join(GEMINI_KNOWLEDGE_DIR, kiSlug);
    const kiArtifactsDir = path.join(kiDir, "artifacts");

    const metadata = {
      id: kiSlug,
      title: `Projeto: ${slug} - Memória, Arquitetura e Regras`,
      summary: `Contexto completo do projeto ${slug} preservado pelo Harness Leca. Contém ${data.chatsCount} conversas analisadas, regras de negócio, decisões arquiteturais e memórias duráveis.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ["harness-leca", slug, "memoria", "regras", "contexto"],
      references: [
        path.join(ROOT, "projects", slug),
      ],
      artifacts: [
        "artifacts/memory.md",
        "artifacts/regras.md",
        "artifacts/conversas-indice.md",
      ],
    };

    writeFile(path.join(kiDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n", dryRun);
    writeFile(path.join(kiArtifactsDir, "memory.md"), `# Memórias e Arquitetura: ${slug}\n\n${data.memoryMd}\n\n## Detalhes Consolidados\n\n${data.memoriasConsolidadas || "Nenhum detalhe adicional"}`, dryRun);
    writeFile(path.join(kiArtifactsDir, "regras.md"), `# Regras de Negócio e Diretrizes: ${slug}\n\n${data.extraidoRegras || "Nenhuma regra cadastrada"}`, dryRun);
    writeFile(path.join(kiArtifactsDir, "conversas-indice.md"), `# Histórico de Conversas: ${slug}\n\n${data.extraidoConversas || `Total de conversas: ${data.chatsCount}`}`, dryRun);
    totalGeminiKIs++;
    io.log(`   [Gemini] -> Knowledge Item: ${kiSlug}`);

    // -----------------------------------------------------------------
    // 3. CONTEXTO LOCAL NO HARNESS-LECA: .claude/context/ e .gemini/context/
    // -----------------------------------------------------------------
    const localSummary = `# Contexto do Projeto: ${slug}
Data de Sincronização: ${today} | Conversas Salvas: ${data.chatsCount}

## Instruções
${data.instructionsMd || "Nenhuma instrução específica."}

## Memórias Ativas
${data.memoryMd || "Nenhuma memória ativa."}

## Regras
${data.extraidoRegras || "Nenhuma regra adicional."}
`;
    writeFile(path.join(LOCAL_CLAUDE_CTX, `${slug}.md`), localSummary, dryRun);
    writeFile(path.join(LOCAL_GEMINI_CTX, `${slug}.md`), localSummary, dryRun);

    overviewList.push({
      slug,
      chatsCount: data.chatsCount,
      hasMemory: Boolean(data.memoryMd),
    });
  }

  // -----------------------------------------------------------------
  // 4. GEMINI / ANTIGRAVITY: Regra Global em ~/.gemini/config/rules/
  // -----------------------------------------------------------------
  const globalRuleContent = `# Harness Leca: Conhecimento Global de Projetos
<!-- Gerado automaticamente em ${today} - Não editar manualmente -->
Este documento registra a lista e o estado dos projetos gerenciados pelo Harness Leca na máquina.

## Projetos Ativos e Memórias Disponíveis:
${overviewList.map((p) => `- **${p.slug}**: ${p.chatsCount} conversas salvas no harness-leca. Memórias e regras disponíveis nos Knowledge Items (\`ki-projeto-${p.slug}\`) e em \`projects/${p.slug}/\`.`).join("\n")}

## Diretriz de Uso para o Gemini/Antigravity:
Ao trabalhar em qualquer tarefa desses projetos, consulte os Knowledge Items correspondentes ou leia \`projects/<slug>/memory.md\` e \`projects/<slug>/context/\` para respeitar as preferências de código, arquitetura e decisões históricas.
`;

  writeFile(path.join(GEMINI_RULES_DIR, "harness-projects-overview.md"), globalRuleContent, dryRun);
  io.log(`\n   [Gemini Global Rule] -> ~/.gemini/config/rules/harness-projects-overview.md`);

  io.log(`\n✔ Concluído com sucesso!`);
  io.log(`  - Pastas do Claude Code sincronizadas: ${totalClaudeFolders}`);
  io.log(`  - Knowledge Items do Gemini criados: ${totalGeminiKIs}`);
  io.log(`  - Regra global do Gemini atualizada em ~/.gemini/config/rules/`);
  io.log(`  - Pastas locais .claude/context e .gemini/context geradas no workspace.`);
}

module.exports = { run };
if (require.main === module) runAsScript(run);

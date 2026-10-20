#!/usr/bin/env node
// @ts-check
// Converte os chats do Harness Leca (projects/<slug>/chats/*.md) em sessões nativas
// do Claude Code (~/.claude/projects/<pasta>/<sessionId>.jsonl), permitindo que apareçam
// no histórico interativo do comando `claude --resume` e sejam continuadas no terminal.
//
// Uso:
//   node tools/export-claude-sessions.js                    converte todos os projetos
//   node tools/export-claude-sessions.js --project <slug>   converte apenas um projeto
//   node tools/export-claude-sessions.js --dry-run          simula sem gravar nada
//   node tools/export-claude-sessions.js --force            sobrescreve sessões existentes

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const { ROOT } = require("./lib/root");
const { existingSlugs, matchers, projectFromPath } = require("./lib/projects");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { readMeta, stripFrontmatter, splitTurns } = require("./lib/chat-format");

const HOME = os.homedir();
const CLAUDE_PROJECTS_DIR = path.join(HOME, ".claude", "projects");

/**
 * Converte um caminho absoluto de pasta em nome de pasta do Claude Code em ~/.claude/projects/
 * @param {string} dirPath
 * @returns {string}
 */
function pathToClaudeDirName(dirPath) {
  const resolved = path.resolve(dirPath);
  return resolved.replace(/:/g, "-").replace(/[\\\/]/g, "-").replace(/[^a-zA-Z0-9_-]/g, "-");
}

// Mapeamentos conhecidos para as pastas de projetos Git no Claude Code
const KNOWN_GIT_MAPPINGS = {
  "57multimarcas": "c--Users-matheuss-rodrigues-git-57multimarcas",
  "saude-dispensacao": "c--Users-matheuss-rodrigues-git-saude-dispensacao",
  "saude-prontuario": "c--Users-matheuss-rodrigues-git-saude-prontuario",
  "conversor-relatorio-maquininhas": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas",
  "conversor-relatorio-maquininhas-meu": "c--Users-matheuss-rodrigues-git-conversor-relatorio-maquininhas-meu",
  "dai": "c--Users-matheuss-rodrigues-git-DAI",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Garante que a sessão tenha um UUID RFC 4122 válido para o Claude Code.
 * @param {string} rawId
 * @returns {string}
 */
function toValidUuid(rawId) {
  const trimmed = String(rawId || "").trim();
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const hash = crypto.createHash("sha256").update(trimmed || crypto.randomUUID()).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Converte o arquivo markdown em linhas JSONL compatíveis com o Claude Code.
 * @param {string} mdPath
 * @param {string} defaultCwd
 * @returns {{ sessionId: string, title: string, turnsCount: number, lines: string[] } | null}
 */
function convertChatMdToJsonl(mdPath, defaultCwd) {
  let content = "";
  try {
    content = fs.readFileSync(mdPath, "utf8");
  } catch {
    return null;
  }

  const meta = readMeta(content);
  const rawSessao = meta("sessao");
  if (!rawSessao) return null;

  const sessionId = toValidUuid(rawSessao);
  const title = meta("titulo") || path.basename(mdPath, ".md");
  const origem = meta("origem") || defaultCwd;
  const inicioStr = meta("inicio");
  const fimStr = meta("fim");

  let startTime = Date.now();
  if (inicioStr) {
    const parsed = Date.parse(inicioStr);
    if (!isNaN(parsed)) startTime = parsed;
  }

  const body = stripFrontmatter(content).replace(/^# .*\r?\n/, "");
  const turns = splitTurns(body);
  if (!turns.length) return null;

  const jsonlLines = [];

  // Cabeçalho da sessão Claude Code
  jsonlLines.push(JSON.stringify({ type: "mode", mode: "normal", sessionId }));
  jsonlLines.push(JSON.stringify({ type: "permission-mode", permissionMode: "auto", sessionId }));

  let lastUuid = null;
  let lastUserPrompt = title;
  let currentTimestamp = startTime;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const turnUuid = crypto.randomUUID();
    const isoTime = new Date(currentTimestamp).toISOString();

    if (turn.speaker.toLowerCase() === "você" || turn.speaker.toLowerCase() === "voce") {
      lastUserPrompt = turn.text.slice(0, 300);
      jsonlLines.push(
        JSON.stringify({
          parentUuid: lastUuid,
          isSidechain: false,
          type: "user",
          message: { role: "user", content: turn.text },
          uuid: turnUuid,
          timestamp: isoTime,
          sessionId,
          cwd: origem,
        })
      );
    } else {
      // Turno de assistente (Claude, Gemini, Antigravity, opencode)
      jsonlLines.push(
        JSON.stringify({
          parentUuid: lastUuid,
          isSidechain: false,
          type: "assistant",
          message: {
            model: "claude-sonnet-5",
            role: "assistant",
            content: [{ type: "text", text: turn.text }],
          },
          uuid: turnUuid,
          timestamp: isoTime,
          sessionId,
          cwd: origem,
        })
      );
    }

    lastUuid = turnUuid;
    currentTimestamp += 3000; // Incrementa 3s a cada turno
  }

  // Evento final de resumo da sessão
  jsonlLines.push(
    JSON.stringify({
      type: "last-prompt",
      lastPrompt: lastUserPrompt,
      leafUuid: lastUuid,
      sessionId,
    })
  );

  return {
    sessionId,
    title,
    turnsCount: turns.length,
    lines: jsonlLines,
  };
}

function ensureDir(dirPath, dryRun) {
  if (!dryRun && !fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function run(argv, io = console) {
  const dryRun = flag("dry-run", argv);
  const force = flag("force", argv);
  const noHarnessMirror = flag("no-harness-mirror", argv);
  const targetProject = opt("project", argv);

  const slugs = existingSlugs();
  if (targetProject && !slugs.includes(targetProject)) {
    throw new CliError(`Projeto "${targetProject}" não encontrado. Disponíveis: ${slugs.join(", ")}`);
  }

  const projectsToProcess = targetProject ? [targetProject] : slugs;

  io.log(`\n======================================================`);
  io.log(` Exportando Chats do Harness Leca -> Claude Code (.jsonl)`);
  io.log(` Modo: ${dryRun ? "[SIMULAÇÃO / DRY RUN]" : "ESCRITA REAL"} ${force ? "[FORCE OVERWRITE]" : ""}`);
  io.log(`======================================================\n`);

  let totalExported = 0;
  let totalSkipped = 0;
  let totalMirrored = 0;

  const currentHarnessFolder = pathToClaudeDirName(ROOT);
  const harnessMirrorDirs = new Set([
    currentHarnessFolder,
    currentHarnessFolder.replace(/^[a-z]/, (c) => c.toUpperCase()),
    currentHarnessFolder.replace(/^[A-Z]/, (c) => c.toLowerCase()),
    "C--Users-matheuss-rodrigues-Desktop-harness-leca",
  ]);

  if (!dryRun) {
    for (const dirName of harnessMirrorDirs) {
      ensureDir(path.join(CLAUDE_PROJECTS_DIR, dirName), dryRun);
    }
  }

  for (const slug of projectsToProcess) {
    const chatsDir = path.join(ROOT, "projects", slug, "chats");
    if (!fs.existsSync(chatsDir)) continue;

    const files = fs.readdirSync(chatsDir).filter((f) => f.endsWith(".md"));
    if (!files.length) continue;

    const defaultProjectDir = pathToClaudeDirName(path.join(ROOT, "projects", slug));
    const targetClaudeFolderName = KNOWN_GIT_MAPPINGS[slug] || defaultProjectDir;
    const targetProjectDir = path.join(CLAUDE_PROJECTS_DIR, targetClaudeFolderName);
    ensureDir(targetProjectDir, dryRun);

    io.log(`📂 Projeto: ${slug} (${files.length} conversas salvas)`);
    io.log(`   -> Destino primário: ~/.claude/projects/${targetClaudeFolderName}/`);

    let projExported = 0;
    let projSkipped = 0;

    for (const f of files) {
      const fullPath = path.join(chatsDir, f);
      const converted = convertChatMdToJsonl(fullPath, path.join(ROOT, "projects", slug));
      if (!converted) continue;

      const filename = `${converted.sessionId}.jsonl`;
      const primaryOutFile = path.join(targetProjectDir, filename);

      const payload = converted.lines.join("\n") + "\n";

      // Verifica se já existe um arquivo maior (ex: sessão nativa com snapshots de ferramentas)
      if (!force && fs.existsSync(primaryOutFile)) {
        try {
          const stat = fs.statSync(primaryOutFile);
          if (stat.size >= payload.length) {
            projSkipped++;
            totalSkipped++;
            continue;
          }
        } catch {}
      }

      if (!dryRun) {
        fs.writeFileSync(primaryOutFile, payload, "utf8");
      }
      projExported++;
      totalExported++;

      // Também grava nos diretórios de espelho do harness para ficar disponível no `claude --resume` do workspace atual
      if (!noHarnessMirror) {
        for (const mirrorDirName of harnessMirrorDirs) {
          const mirrorOutFile = path.join(CLAUDE_PROJECTS_DIR, mirrorDirName, filename);
          if (!dryRun) {
            fs.writeFileSync(mirrorOutFile, payload, "utf8");
          }
          totalMirrored++;
        }
      }
    }

    io.log(`   ✔ Exportadas: ${projExported} | Mantidas originais: ${projSkipped}`);
  }

  io.log(`\n======================================================`);
  io.log(`✔ Processo concluído!`);
  io.log(`  - Total de sessões geradas no Claude Code: ${totalExported}`);
  io.log(`  - Sessões nativas já existentes preservadas: ${totalSkipped}`);
  if (!noHarnessMirror) {
    io.log(`  - Sessões espelhadas no workspace do harness: ${totalMirrored}`);
  }
  io.log(`\nAgora você pode abrir o terminal e rodar:`);
  io.log(`  claude --resume`);
  io.log(`Todas as conversas restauradas estarão disponíveis na lista!`);
  io.log(`======================================================\n`);
}

module.exports = { run, convertChatMdToJsonl };
if (require.main === module) runAsScript(run);

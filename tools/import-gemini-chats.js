#!/usr/bin/env node
// Converte conversas do Antigravity/Gemini
// (~/.gemini/antigravity-ide/brain/<uuid>/.system_generated/logs/transcript.jsonl)
// em .md dentro de projects/<slug>/chats/, para aparecerem na interface do harness
// e serem lidas pelos extratores de conhecimento.
//
// Formato gerado (compatível com o harness e Claude Code):
//   ## Você / ## Gemini          -> turnos da conversa
//   :::tool Nome | resumo        -> chamadas e resultados de ferramentas em accordion
//   :::thinking                  -> raciocínio interno do modelo
//
// Uso:
//   node tools/import-gemini-chats.js --list
//   node tools/import-gemini-chats.js --project saude-dispensacao [--dry-run] [--no-tools]
//   node tools/import-gemini-chats.js --from <session-uuid> --project <slug>
//   node tools/import-gemini-chats.js --all-projects [--dry-run]

const fs = require("fs");
const os = require("os");
const path = require("path");

const { ROOT } = require("./lib/root");

const { redact } = require("./lib/redact");
const { slugify } = require("./lib/text");
const { parseSession, renderChat, listSessions } = require("./lib/gemini-import/sessions");
const { resetProjectMatchers } = require("./lib/gemini-import/text");
const { writeChat } = require("./lib/chat-store");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");

const USAGE = `Uso:
  node tools/import-gemini-chats.js --list
  node tools/import-gemini-chats.js --project <slug> [--dry-run] [--no-tools] [--limit N]
  node tools/import-gemini-chats.js --from <session-uuid> --project <slug>
  node tools/import-gemini-chats.js --all-projects [--dry-run]`;

// Importa as sessões do Antigravity/Gemini para projects/<slug>/chats.
// argv: os mesmos argumentos da CLI. io.log recebe o relatório. home: onde procurar ~/.gemini (os testes trocam).
// onlyProjects (Set de slugs): classifica cada sessão pelo projeto detectado e importa só as dos projetos do conjunto,
//   sem criar projeto novo; o sync usa isto para ler as transcrições uma vez em vez de uma por projeto.
// Retorna { nova, atualizada, igual, ignoradas, porProjeto: { slug: { nova, atualizada, igual } } }; erros de uso viram CliError.
function run(argv, io = console, { home = os.homedir(), onlyProjects } = {}) {
  const has = (n) => flag(n, argv), get = (n) => opt(n, argv);
  const brainRoot = path.join(home, ".gemini", "antigravity-ide", "brain");
  const result = { nova: 0, atualizada: 0, igual: 0, ignoradas: 0, porProjeto: {} };
  resetProjectMatchers(); // relê projects/ e .sources.json a cada execução

  if (has("list")) {
    const sessions = listSessions(brainRoot);
    io.log(`\nEncontradas ${sessions.length} sessões do Gemini/Antigravity:\n`);
    io.log("Data       | Projeto detectado              | Turnos | Sessão   | Título / Início");
    io.log("-----------+--------------------------------+--------+----------+--------------------------------------");
    for (const s of sessions) {
      const c = parseSession(s.path, s.id, false);
      if (!c) continue;
      const date = (c.first || s.mtime.toISOString()).slice(0, 10);
      const proj = (c.project || "desconhecido").padEnd(30).slice(0, 30);
      const turns = String(c.turns.length).padStart(6);
      io.log(`${date} | ${proj} | ${turns} | ${s.id.slice(0, 8)} | ${c.title.slice(0, 45)}`);
    }
    return result;
  }

  const targetProject = get("project");
  // Mesma regra de state.js: o slug vira caminho em projects/, então nada de "..", barras ou maiúsculas.
  if (targetProject !== undefined && !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(targetProject)) {
    throw new CliError(`--project inválido: "${targetProject}" (use letras minúsculas, números, - ou _)`);
  }
  const fromSession = get("from");
  const allProjects = has("all-projects");
  const limit = get("limit") ? parseInt(get("limit"), 10) : Infinity;
  if (!targetProject && !fromSession && !allProjects && !onlyProjects) throw new CliError(USAGE);

  const dry = has("dry-run");
  const sessions = listSessions(brainRoot);

  for (const s of sessions) {
    if (result.nova + result.atualizada >= limit) break;
    if (fromSession && fromSession !== "all" && !s.id.toLowerCase().startsWith(fromSession.toLowerCase())) continue;

    const c = parseSession(s.path, s.id, !has("no-tools"));
    if (!c || !c.turns.length) { result.ignoradas++; continue; }

    const destProject = targetProject || (allProjects || onlyProjects ? c.project : null);
    if (!destProject || destProject === "desconhecido" || destProject === "outros") {
      if (!targetProject) { result.ignoradas++; continue; }
    }
    if (onlyProjects && !onlyProjects.has(destProject)) continue; // projeto que não existe (ou não foi pedido): não cria

    // Se o usuário especificou --project sem --from, filtra para importar apenas as sessões do projeto correspondente
    if (targetProject && !fromSession && c.project !== targetProject) continue;

    const destDir = path.join(ROOT, "projects", destProject);
    if (!fs.existsSync(destDir) && !dry) {
      fs.cpSync(path.join(ROOT, "projects", "_template"), destDir, { recursive: true });
      io.log(`Projeto criado: projects/${destProject}`);
    }

    const chatsDir = path.join(destDir, "chats");
    if (!dry) fs.mkdirSync(chatsDir, { recursive: true });

    const date = (c.first || "").slice(0, 10) || "sem-data";
    const name = `${date}-${slugify(c.title)}-${c.sessionId.slice(0, 8)}.md`;
    const text = redact(renderChat(c));
    // Sem mtime: as sessões do Gemini sempre ficaram com a data da importação (a interface ordena por ela).
    const { state, removed } = writeChat({ chatsDir, name, sessionId: c.sessionId, shortId: c.sessionId.slice(0, 8), text, dryRun: dry });
    io.log(`${dry ? "[dry-run] " : ""}[${state}] (${destProject}) ${name} (${c.turns.length} turnos)`);
    for (const old of removed) io.log(`  (renomeada; removido ${old})`);

    const key = state === "sem mudança" ? "igual" : state;
    result[key]++;
    (result.porProjeto[destProject] ||= { nova: 0, atualizada: 0, igual: 0 })[key]++;
  }

  io.log(`\nConcluído: ${result.nova + result.atualizada} importada(s), ${result.igual} sem mudança, ${result.ignoradas} ignorada(s).`);
  return result;
}

module.exports = { run };
if (require.main === module) {
  // Previne erro EPIPE ao paginar/filtrar no terminal
  process.stdout.on("error", (err) => { if (err.code === "EPIPE") process.exit(0); });
  runAsScript(run);
}

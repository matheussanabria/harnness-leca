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

// Previne erro EPIPE ao paginar/filtrar no terminal
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") process.exit(0);
});

const ROOT = path.resolve(__dirname, "..");
const BRAIN_ROOT = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");
const MAX_IO = 1500; // limite de caracteres por entrada/resultado de ferramenta
const MAX_FILE = 200 * 1024 * 1024; // arquivos maiores são ignorados

const { redact } = require("./lib/redact");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sem-titulo";

const clip = (s) => {
  s = String(s ?? "").trim();
  return s.length > MAX_IO ? `${s.slice(0, MAX_IO)}\n… (+${s.length - MAX_IO} caracteres)` : s;
};

// Linhas ":::" no conteúdo quebrariam os blocos da interface.
const safe = (s) => clip(s).replace(/^:::/gm, "::​:");

function cleanUserText(text) {
  if (!text) return "";
  // Se tem a tag <USER_REQUEST>, prioriza o conteúdo dela
  const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  let clean = reqMatch ? reqMatch[1] : text;

  // Remove blocos de metadados e settings injetados pelo sistema
  clean = clean
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, "")
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, "")
    .replace(/<(system-reminder|ide_[a-z_]+|command-[a-z-]+|local-command-[a-z-]+|project-harness|task-notification)>[\s\S]*?<\/\1>/gi, "")
    .trim();

  // Limpa menções @[c:\...] deixando apenas o nome legível do arquivo
  clean = clean.replace(/@\[([^\]]+)\]/g, (m, p) => `\`${path.basename(p)}\``);

  return clean.trim();
}

function detectProjectFromText(text) {
  if (!text) return null;
  if (/saude[\\/]dispensacao/i.test(text)) return "saude-dispensacao";
  if (/57multimarcas/i.test(text)) return "57multimarcas";
  if (/saude[\\/]prontuario|prontuario-web|prontuario-api/i.test(text)) return "saude-prontuario";
  if (/harness-leca/i.test(text)) return "harness-leca";
  if (/conversor-relatorio-maquininhas/i.test(text)) return "conversor-relatorio-maquininhas";
  if (/cerebro-digital|Obsidian/i.test(text)) return "obsidian";

  const gitMatch = text.match(/[\\/]git[\\/]([a-zA-Z0-9_-]+)/i);
  if (gitMatch) return gitMatch[1].toLowerCase();

  return null;
}

function cleanTitle(raw) {
  if (!raw) return "Conversa sem título";
  let t = raw
    .replace(/<USER_REQUEST>/gi, "")
    .replace(/<\/USER_REQUEST>/gi, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[`*#_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Se começou com caminho de arquivo, pega o nome base ou o texto após o caminho
  const fileStartMatch = t.match(/^([a-zA-Z]:\\[^ ]+)\s*(.*)/);
  if (fileStartMatch) {
    const base = path.basename(fileStartMatch[1]);
    t = fileStartMatch[2] ? `${base} — ${fileStartMatch[2]}` : base;
  }

  return t.slice(0, 70).trim() || "Conversa sem título";
}

function toolHint(name, argsObj) {
  if (!argsObj) return "";
  let obj = argsObj;
  if (typeof argsObj === "string") {
    try { obj = JSON.parse(argsObj); } catch {}
  }
  const raw = obj.toolSummary ||
    obj.toolAction ||
    obj.AbsolutePath ||
    obj.TargetFile ||
    obj.CommandLine ||
    obj.Query ||
    obj.DirectoryPath ||
    obj.Url ||
    "";
  return String(raw).replace(/\s+/g, " ").slice(0, 120);
}

function parseSession(sessionDir, sessionId, withTools = true) {
  const logFile = path.join(sessionDir, ".system_generated", "logs", "transcript.jsonl");
  if (!fs.existsSync(logFile)) return null;

  const st = fs.statSync(logFile);
  if (st.size > MAX_FILE) return null;

  const raw = fs.readFileSync(logFile, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const steps = [];
  for (const l of lines) {
    try { steps.push(JSON.parse(l)); } catch {}
  }
  if (!steps.length) return null;

  let firstDate = null, lastDate = null;
  let originPath = "";
  let rawProject = null;

  const turns = [];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.created_at) {
      if (!firstDate) firstDate = s.created_at;
      lastDate = s.created_at;
    }

    if (s.type === "USER_INPUT") {
      const text = s.content || "";
      if (!rawProject) rawProject = detectProjectFromText(text);

      const docMatch = text.match(/Active Document:\s*([^\r\n(]+)/);
      if (docMatch && !originPath) originPath = docMatch[1].trim();

      const userText = cleanUserText(text);
      if (userText) {
        turns.push({ who: "user", parts: [{ kind: "text", text: userText }] });
      }
    } else if (s.type === "PLANNER_RESPONSE") {
      const parts = [];

      if (withTools && s.thinking && s.thinking.trim()) {
        parts.push({ kind: "thinking", text: s.thinking.trim() });
      }

      if (s.tool_calls && s.tool_calls.length) {
        let toolResultIdx = i + 1;
        for (const tc of s.tool_calls) {
          if (!originPath && tc.args && tc.args.Cwd) originPath = tc.args.Cwd;
          if (!rawProject && tc.args) rawProject = detectProjectFromText(JSON.stringify(tc.args));

          let resultText = "";
          let isError = false;

          // Procura o próximo passo correspondente ao resultado desta ferramenta
          while (toolResultIdx < steps.length) {
            const next = steps[toolResultIdx++];
            if (next.type === "PLANNER_RESPONSE" || next.type === "USER_INPUT") {
              toolResultIdx--; // volta um passo pois é o próximo turno
              break;
            }
            // Passos de resultado de ferramenta (VIEW_FILE, RUN_COMMAND, CODE_ACTION etc.)
            if (next.content !== undefined || next.status === "ERROR") {
              resultText = String(next.content || "");
              isError = next.status === "ERROR";
              break;
            }
          }

          if (withTools) {
            parts.push({
              kind: "tool",
              name: tc.name,
              hint: toolHint(tc.name, tc.args),
              input: typeof tc.args === "object" ? JSON.stringify(tc.args, null, 2) : String(tc.args || ""),
              result: resultText,
              error: isError
            });
          }
        }
      }

      if (s.content && s.content.trim()) {
        parts.push({ kind: "text", text: s.content.trim() });
      }

      if (parts.length) {
        const last = turns[turns.length - 1];
        if (last && last.who === "gemini") {
          last.parts.push(...parts);
        } else {
          turns.push({ who: "gemini", parts });
        }
      }
    }
  }

  if (!turns.length) return null;

  // Determina título limpo da conversa
  let title = "";
  const firstUser = turns.find((t) => t.who === "user");
  if (firstUser && firstUser.parts[0] && firstUser.parts[0].text) {
    const firstLine = firstUser.parts[0].text.split("\n")[0];
    title = cleanTitle(firstLine);
  }
  if (!title) title = "Conversa sem título";

  return {
    sessionId,
    title,
    origin: originPath,
    project: rawProject || "desconhecido",
    first: firstDate || "",
    last: lastDate || "",
    turns
  };
}

function renderPart(p) {
  if (p.kind === "text") return p.text;
  if (p.kind === "thinking") return `:::thinking\n${safe(p.text)}\n:::`;
  return `:::tool ${p.name} | ${p.hint.replace(/\|/g, "/")}${p.error ? " | erro" : ""}\n--- entrada\n${safe(p.input)}\n--- resultado\n${safe(p.result)}\n:::`;
}

function renderChat(c) {
  const head = [
    "---",
    `titulo: ${JSON.stringify(c.title)}`,
    `sessao: ${c.sessionId}`,
    `origem: ${JSON.stringify(c.origin)}`,
    `inicio: ${c.first || ""}`,
    `fim: ${c.last || ""}`,
    "agente: \"gemini\"",
    "---",
    "",
    `# ${c.title}`,
    "",
  ];
  const body = c.turns.map((t) =>
    `## ${t.who === "user" ? "Você" : "Gemini"}\n\n${t.parts.map(renderPart).join("\n\n")}\n`);
  return head.concat(body).join("\n");
}

function listSessions() {
  if (!fs.existsSync(BRAIN_ROOT)) {
    console.error("Diretório do Antigravity/Gemini não encontrado em:", BRAIN_ROOT);
    process.exit(1);
  }

  const dirs = fs.readdirSync(BRAIN_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const logFile = path.join(BRAIN_ROOT, d.name, ".system_generated", "logs", "transcript.jsonl");
      if (!fs.existsSync(logFile)) return null;
      const st = fs.statSync(logFile);
      return { id: d.name, path: path.join(BRAIN_ROOT, d.name), mtime: st.mtime, size: st.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  return dirs;
}

// ------------------- Comandos CLI -------------------

if (flag("list")) {
  const sessions = listSessions();
  console.log(`\nEncontradas ${sessions.length} sessões do Gemini/Antigravity:\n`);
  console.log("Data       | Projeto detectado              | Turnos | Sessão   | Título / Início");
  console.log("-----------+--------------------------------+--------+----------+--------------------------------------");

  for (const s of sessions) {
    const c = parseSession(s.path, s.id, false);
    if (!c) continue;
    const date = (c.first || s.mtime.toISOString()).slice(0, 10);
    const proj = (c.project || "desconhecido").padEnd(30).slice(0, 30);
    const turns = String(c.turns.length).padStart(6);
    const shortId = s.id.slice(0, 8);
    const title = c.title.slice(0, 45);
    console.log(`${date} | ${proj} | ${turns} | ${shortId} | ${title}`);
  }
  process.exit(0);
}

const targetProject = opt("project");
const fromSession = opt("from");
const allProjects = flag("all-projects");
const limit = opt("limit") ? parseInt(opt("limit"), 10) : Infinity;

if (!targetProject && !fromSession && !allProjects) {
  console.log(`
Uso:
  node tools/import-gemini-chats.js --list
  node tools/import-gemini-chats.js --project <slug> [--dry-run] [--no-tools] [--limit N]
  node tools/import-gemini-chats.js --from <session-uuid> --project <slug>
  node tools/import-gemini-chats.js --all-projects [--dry-run]
`);
  process.exit(1);
}

const sessions = listSessions();
let imported = 0, skipped = 0, unchanged = 0;

for (const s of sessions) {
  if (imported >= limit) break;
  if (fromSession && fromSession !== "all" && !s.id.toLowerCase().startsWith(fromSession.toLowerCase())) {
    continue;
  }

  const c = parseSession(s.path, s.id, !flag("no-tools"));
  if (!c || !c.turns.length) { skipped++; continue; }

  const destProject = targetProject || (allProjects ? c.project : null);
  if (!destProject || destProject === "desconhecido" || destProject === "outros") {
    if (!targetProject) { skipped++; continue; }
  }

  // Se o usuário especificou --project sem --from, filtra para importar apenas as sessões do projeto correspondente
  if (targetProject && !fromSession && c.project !== targetProject) {
    continue;
  }

  const destDir = path.join(ROOT, "projects", destProject);
  if (!fs.existsSync(destDir) && !flag("dry-run")) {
    fs.cpSync(path.join(ROOT, "projects", "_template"), destDir, { recursive: true });
    console.log(`Projeto criado: projects/${destProject}`);
  }

  const chatsDir = path.join(destDir, "chats");
  if (!flag("dry-run")) fs.mkdirSync(chatsDir, { recursive: true });

  const date = (c.first || "").slice(0, 10) || "sem-data";
  const name = `${date}-${slugify(c.title)}-${c.sessionId.slice(0, 8)}.md`;
  const outPath = path.join(chatsDir, name);
  const text = redact(renderChat(c));

  const before = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : null;
  const state = before === null ? "nova" : before === text ? "sem mudança" : "atualizada";

  console.log(`${flag("dry-run") ? "[dry-run] " : ""}[${state}] (${destProject}) ${name} (${c.turns.length} turnos)`);

  if (!flag("dry-run")) {
    if (state !== "sem mudança") {
      // Remove versão antiga da mesma sessão se o título tiver mudado
      if (fs.existsSync(chatsDir)) {
        for (const old of fs.readdirSync(chatsDir)) {
          if (old !== name && old.endsWith(`-${c.sessionId.slice(0, 8)}.md`)) {
            try { fs.rmSync(path.join(chatsDir, old)); } catch {}
          }
        }
      }
      fs.writeFileSync(outPath, text, "utf8");
      imported++;
    } else {
      unchanged++;
    }
  } else {
    imported++;
  }
}

console.log(`\nConcluído: ${imported} importada(s), ${unchanged} sem mudança, ${skipped} ignorada(s).`);

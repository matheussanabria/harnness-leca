#!/usr/bin/env node
// Converte conversas do Claude Code (~/.claude/projects/<pasta>/*.jsonl) em .md
// dentro de projects/<slug>/chats/, para aparecerem na interface do harness.
//
// Formato gerado (lido pela interface):
//   ## Você / ## Claude          -> turnos da conversa
//   :::tool Nome | resumo [| erro]   ... --- entrada ... --- resultado ... :::
//                                -> processamento interno (ferramentas), em accordion na interface
//   :::thinking                  -> raciocínio, quando o texto estiver disponível
//
// Uso:
//   node tools/import-claude-code-chats.js --list
//   node tools/import-claude-code-chats.js --from 57multimarcas --project 57multimarcas [--no-tools] [--dry-run]

const fs = require("fs");
const os = require("os");
const path = require("path");

const { ROOT } = require("./lib/root");

const { redact } = require("./lib/redact"); // redação de segredos comuns (heurística)
const { slugify } = require("./lib/text");
const { renderChat } = require("./lib/chat-format");
const { writeChat } = require("./lib/chat-store");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { MAX_FILE } = require("./lib/limits");




// Remove blocos injetados pelo IDE/harness que não fazem parte da fala do usuário.
function cleanUser(text) {
  return text
    .replace(/<(system-reminder|ide_[a-z_]+|command-[a-z-]+|local-command-[a-z-]+|project-harness|task-notification)>[\s\S]*?<\/\1>/g, "")
    .trim();
}

function toolHint(b) {
  const i = b.input || {};
  return String(i.file_path || i.path || i.pattern || i.command || i.description || i.url || i.query || "")
    .replace(/\s+/g, " ").slice(0, 120);
}

const resultText = (c) =>
  typeof c === "string" ? c : (c || []).map((x) => (x.type === "text" ? x.text : `[${x.type}]`)).join("\n");

function convert(file, withTools) {
  const events = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });

  let title = "", cwd = "", first, last;
  const results = new Map(); // tool_use_id -> { text, error }
  for (const e of events) {
    const content = e.message && e.message.content;
    if (e.type === "user" && Array.isArray(content)) {
      for (const b of content) if (b.type === "tool_result") results.set(b.tool_use_id, { text: resultText(b.content), error: !!b.is_error });
    }
  }

  const turns = []; // { who, parts: [{kind, ...}] }
  const push = (who, part) => {
    const t = turns[turns.length - 1];
    if (t && t.who === who) t.parts.push(part); else turns.push({ who, parts: [part] });
  };

  for (const e of events) {
    if (e.type === "ai-title" && e.aiTitle) title = e.aiTitle;
    if (e.timestamp) { first = first || e.timestamp; last = e.timestamp; }
    if (e.cwd && !cwd) cwd = e.cwd;
    if (e.isSidechain || e.isMeta || !e.message) continue;

    const content = e.message.content;
    const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content || [];

    if (e.type === "user") {
      const text = blocks.filter((b) => b.type === "text").map((b) => cleanUser(b.text)).filter(Boolean).join("\n\n");
      const imgs = blocks.filter((b) => b.type === "image").length;
      const out = [text, imgs ? `_[${imgs} imagem(ns) anexada(s)]_` : ""].filter(Boolean).join("\n\n");
      if (out) push("user", { kind: "text", text: out });
    } else if (e.type === "assistant") {
      for (const b of blocks) {
        if (b.type === "text" && b.text.trim()) push("assistant", { kind: "text", text: b.text.trim() });
        else if (b.type === "thinking" && withTools && (b.thinking || "").trim()) push("assistant", { kind: "thinking", text: b.thinking });
        else if (b.type === "tool_use" && withTools) {
          const r = results.get(b.id) || { text: "", error: false };
          push("assistant", { kind: "tool", name: b.name, hint: toolHint(b), input: JSON.stringify(b.input || {}, null, 2), result: r.text, error: r.error });
        }
      }
    }
  }

  const firstUser = turns.find((t) => t.who === "user");
  if (!title && firstUser) title = firstUser.parts[0].text.replace(/\s+/g, " ").slice(0, 70);
  return { title: title || "Sem título", cwd, first, last, turns };
}

function render(c, sessionId) {
  return renderChat({ title: c.title, sessionId, origin: c.cwd, first: c.first, last: c.last, agent: "claude", assistantLabel: "Claude" }, c.turns);
}

function sourceDirs(sourceRoot) {
  return fs.readdirSync(sourceRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

// Importa as conversas de uma pasta de ~/.claude/projects para projects/<slug>/chats.
// argv: os mesmos argumentos da CLI. io.log recebe o relatório. home: onde procurar ~/.claude (os testes trocam).
// Retorna { nova, atualizada, igual, ignoradas }; erros de uso viram CliError.
function run(argv, io = console, { home = os.homedir() } = {}) {
  const has = (n) => flag(n, argv), get = (n) => opt(n, argv);
  const sourceRoot = path.join(home, ".claude", "projects");
  const result = { nova: 0, atualizada: 0, igual: 0, ignoradas: 0 };

  if (has("list")) {
    for (const d of sourceDirs(sourceRoot)) {
      const n = fs.readdirSync(path.join(sourceRoot, d)).filter((f) => f.endsWith(".jsonl")).length;
      io.log(`${String(n).padStart(3)} conversas  ${d}`);
    }
    return result;
  }

  const from = get("from"), slug = get("project");
  if (!from || !slug) throw new CliError("Uso: node tools/import-claude-code-chats.js --list | --from <pasta> --project <slug> [--no-tools] [--dry-run]");

  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(slug) || slug === "_template") {
    throw new CliError("--project inválido: use apenas letras, números, '-' e '_' (sem barras ou '..').");
  }

  // --from só pode apontar para dentro de ~/.claude/projects (caminho fora dele é recusado).
  const insideSource = (d) => { const r = path.relative(sourceRoot, path.resolve(d)); return r && !r.startsWith("..") && !path.isAbsolute(r); };
  if (fs.existsSync(from) && !insideSource(from)) throw new CliError("--from fora de ~/.claude/projects não é permitido.");
  let dirName = from;
  if (!fs.existsSync(from)) {
    const m = sourceDirs(sourceRoot).filter((d) => d.toLowerCase().includes(from.toLowerCase()));
    if (m.length !== 1) throw new CliError(m.length ? `Ambíguo, use um nome mais específico:\n  ${m.join("\n  ")}` : `Nenhuma pasta contém "${from}".`);
    dirName = path.join(sourceRoot, m[0]);
  }

  const dry = has("dry-run");
  const dest = path.join(ROOT, "projects", slug);
  if (!fs.existsSync(dest) && !dry) {
    fs.cpSync(path.join(ROOT, "projects", "_template"), dest, { recursive: true });
    io.log(`Projeto criado: projects/${slug}`);
  }
  const chatsDir = path.join(dest, "chats");
  if (!dry) fs.mkdirSync(chatsDir, { recursive: true });

  for (const f of fs.readdirSync(dirName).filter((n) => n.endsWith(".jsonl"))) {
    const sessionId = slugify(f.replace(/\.jsonl$/, "")); // só [a-z0-9-] no nome do arquivo gerado
    const src = path.join(dirName, f), st = fs.lstatSync(src);
    if (!st.isFile() || st.size > MAX_FILE) { io.log(`ignorado (symlink ou > 200 MB): ${f}`); result.ignoradas++; continue; }
    const c = convert(src, !has("no-tools"));
    if (!c.turns.length) { result.ignoradas++; continue; }
    const date = (c.first || "").slice(0, 10) || "sem-data";
    const name = `${date}-${slugify(c.title)}-${sessionId.slice(0, 8)}.md`;
    const text = redact(render(c, sessionId));
    const { state, removed } = writeChat({ chatsDir, name, sessionId, shortId: sessionId.slice(0, 8), text, mtime: c.last, dryRun: dry });
    io.log(`${dry ? "[dry-run] " : ""}[${state}] ${name}  (${c.turns.length} turnos)`);
    for (const old of removed) io.log(`  (renomeada; removido ${old})`);
    result[state === "sem mudança" ? "igual" : state]++;
  }
  const processed = result.nova + result.atualizada + result.igual;
  io.log(`\n${processed} conversas processadas (${result.nova + result.atualizada} novas ou atualizadas), ${result.ignoradas} vazias ignoradas.`);
  io.log(`Para ver o que ainda precisa de extração: node tools/extraction-state.js --project ${slug} status`);
  return result;
}

module.exports = { run };
if (require.main === module) runAsScript(run);

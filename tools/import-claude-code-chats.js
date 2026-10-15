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

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(os.homedir(), ".claude", "projects");
const MAX_IO = 1500; // limite de caracteres por entrada/resultado de ferramenta
const MAX_FILE = 200 * 1024 * 1024; // jsonl maiores que isso são ignorados (evita estourar memória)

const { redact } = require("./lib/redact"); // redação de segredos comuns (heurística)

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sem-titulo";

const clip = (s) => {
  s = String(s ?? "").trim();
  return s.length > MAX_IO ? `${s.slice(0, MAX_IO)}\n… (+${s.length - MAX_IO} caracteres)` : s;
};
// Linhas ":::" no conteúdo quebrariam o formato.
const safe = (s) => clip(s).replace(/^:::/gm, "::​:");

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

function renderPart(p) {
  if (p.kind === "text") return p.text;
  if (p.kind === "thinking") return `:::thinking\n${safe(p.text)}\n:::`;
  return `:::tool ${p.name} | ${p.hint.replace(/\|/g, "/")}${p.error ? " | erro" : ""}\n--- entrada\n${safe(p.input)}\n--- resultado\n${safe(p.result)}\n:::`;
}

function render(c, sessionId) {
  const head = [
    "---",
    `titulo: ${JSON.stringify(c.title)}`,
    `sessao: ${sessionId}`,
    `origem: ${JSON.stringify(c.cwd)}`,
    `inicio: ${c.first || ""}`,
    `fim: ${c.last || ""}`,
    "agente: \"claude\"",
    "---",
    "",
    `# ${c.title}`,
    "",
  ];
  const body = c.turns.map((t) =>
    `## ${t.who === "user" ? "Você" : "Claude"}\n\n${t.parts.map(renderPart).join("\n\n")}\n`);
  return head.concat(body).join("\n");
}

function sourceDirs() {
  return fs.readdirSync(SOURCE_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

if (flag("list")) {
  for (const d of sourceDirs()) {
    const n = fs.readdirSync(path.join(SOURCE_ROOT, d)).filter((f) => f.endsWith(".jsonl")).length;
    console.log(`${String(n).padStart(3)} conversas  ${d}`);
  }
  process.exit(0);
}

const from = opt("from"), slug = opt("project");
if (!from || !slug) {
  console.error("Uso: node tools/import-claude-code-chats.js --list | --from <pasta> --project <slug> [--no-tools] [--dry-run]");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(slug) || slug === "_template") {
  console.error("--project inválido: use apenas letras, números, '-' e '_' (sem barras ou '..').");
  process.exit(1);
}

// --from só pode apontar para dentro de ~/.claude/projects (caminho fora dele é recusado).
const insideSource = (d) => { const r = path.relative(SOURCE_ROOT, path.resolve(d)); return r && !r.startsWith("..") && !path.isAbsolute(r); };
if (fs.existsSync(from) && !insideSource(from)) { console.error("--from fora de ~/.claude/projects não é permitido."); process.exit(1); }
const dirName = fs.existsSync(from) ? from : (() => {
  const m = sourceDirs().filter((d) => d.toLowerCase().includes(from.toLowerCase()));
  if (m.length !== 1) { console.error(m.length ? `Ambíguo, use um nome mais específico:\n  ${m.join("\n  ")}` : `Nenhuma pasta contém "${from}".`); process.exit(1); }
  return path.join(SOURCE_ROOT, m[0]);
})();

const dest = path.join(ROOT, "projects", slug);
if (!fs.existsSync(dest) && !flag("dry-run")) {
  fs.cpSync(path.join(ROOT, "projects", "_template"), dest, { recursive: true });
  console.log(`Projeto criado: projects/${slug}`);
}
const chatsDir = path.join(dest, "chats");
if (!flag("dry-run")) fs.mkdirSync(chatsDir, { recursive: true });

let ok = 0, skipped = 0, changed = 0;
for (const f of fs.readdirSync(dirName).filter((n) => n.endsWith(".jsonl"))) {
  const sessionId = slugify(f.replace(/\.jsonl$/, "")); // só [a-z0-9-] no nome do arquivo gerado
  const src = path.join(dirName, f), st = fs.lstatSync(src);
  if (!st.isFile() || st.size > MAX_FILE) { console.log(`ignorado (symlink ou > 200 MB): ${f}`); skipped++; continue; }
  const c = convert(src, !flag("no-tools"));
  if (!c.turns.length) { skipped++; continue; }
  const date = (c.first || "").slice(0, 10) || "sem-data";
  const name = `${date}-${slugify(c.title)}-${sessionId.slice(0, 8)}.md`;
  const out = path.join(chatsDir, name);
  const text = redact(render(c, sessionId));
  const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  const state = before === null ? "nova" : before === text ? "sem mudança" : "atualizada";
  console.log(`${flag("dry-run") ? "[dry-run] " : ""}[${state}] ${name}  (${c.turns.length} turnos)`);
  if (!flag("dry-run") && state !== "sem mudança") {
    // O título (gerado pelo Claude) pode mudar quando a conversa cresce: remove o arquivo antigo da mesma sessão.
    for (const old of fs.readdirSync(chatsDir)) {
      if (old !== name && old.endsWith(`-${sessionId.slice(0, 8)}.md`) && fs.readFileSync(path.join(chatsDir, old), "utf8").includes(`sessao: ${sessionId}\n`)) {
        fs.rmSync(path.join(chatsDir, old));
        console.log(`  (renomeada; removido ${old})`);
      }
    }
    fs.writeFileSync(out, text);
    if (c.last) fs.utimesSync(out, new Date(c.last), new Date(c.last)); // a interface ordena/data pelo mtime
  }
  if (state !== "sem mudança") changed++;
  ok++;
}
console.log(`\n${ok} conversas processadas (${changed} novas ou atualizadas), ${skipped} vazias ignoradas.`);
console.log(`Para ver o que ainda precisa de extração: node tools/extraction-state.js --project ${slug} status`);

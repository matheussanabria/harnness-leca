#!/usr/bin/env node
// Converte conversas do opencode (~/.local/share/opencode/opencode.db) em .md
// dentro de projects/<slug>/chats/, para aparecerem na interface do harness.
//
// Formato gerado (lido pela interface):
//   ## Você / ## opencode        -> turnos da conversa
//   :::tool Nome | resumo [| erro]   ... --- entrada ... --- resultado ... :::
//                                -> processamento interno (ferramentas), em accordion na interface
//   :::thinking                  -> raciocínio (reasoning), quando disponível
//
// Uso:
//   node tools/import-opencode-chats.js --list
//   node tools/import-opencode-chats.js --from <match> --project <slug> [--no-tools] [--dry-run]
//
// --from casa com substring do diretório da sessão (cwd) ou com o início do id
// da sessão. Ex.: --from 57multimarcas --project 57multimarcas

const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DB = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");
const MAX_IO = 1500; // limite de caracteres por entrada/resultado de ferramenta

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

const iso = (ms) => (ms ? new Date(ms).toISOString() : "");

function toolHint(input) {
  return String(input?.file_path || input?.path || input?.pattern || input?.command || input?.description || input?.url || input?.query || input?.filePath || "")
    .replace(/\s+/g, " ").slice(0, 120);
}

function loadSessions(db) {
  return db.prepare(
    `SELECT id, title, directory, time_created, time_updated, agent, model, parent_id
       FROM session ORDER BY time_created`
  ).all().map((r) => ({
    id: r.id,
    title: r.title || "",
    directory: r.directory || "",
    timeCreated: Number(r.time_created || 0),
    timeUpdated: Number(r.time_updated || 0),
    agent: r.agent || "",
    parentId: r.parent_id || null,
  }));
}

function convert(db, session, withTools) {
  // Sessões com parent_id são subagentes (processamento interno), como as sidechains do Claude Code.
  if (session.parentId) return null;

  const messages = db.prepare(
    `SELECT id, data FROM message WHERE session_id = ? ORDER BY time_created`
  ).all(session.id);

  const turns = []; // { who, parts: [{kind, ...}] }
  const push = (who, part) => {
    const t = turns[turns.length - 1];
    if (t && t.who === who) t.parts.push(part); else turns.push({ who, parts: [part] });
  };

  let firstUserText = "";
  for (const m of messages) {
    let msg;
    try { msg = JSON.parse(m.data); } catch { continue; }
    const who = msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : null;
    if (!who) continue;

    const parts = db.prepare(
      `SELECT data FROM part WHERE message_id = ? ORDER BY time_created`
    ).all(m.id);

    for (const p of parts) {
      let part;
      try { part = JSON.parse(p.data); } catch { continue; }

      if (part.type === "text" && (part.text || "").trim()) {
        push(who, { kind: "text", text: part.text.trim() });
        if (who === "user" && !firstUserText) firstUserText = part.text.trim();
      } else if (part.type === "reasoning" && withTools && (part.text || "").trim()) {
        push("assistant", { kind: "thinking", text: part.text.trim() });
      } else if (part.type === "tool" && withTools) {
        const st = part.state || {};
        const input = st.input || {};
        push("assistant", {
          kind: "tool",
          name: part.tool || "tool",
          hint: toolHint(input),
          input: JSON.stringify(input, null, 2),
          result: String(st.output ?? ""),
          error: st.status === "error",
        });
      } else if (part.type === "file") {
        push(who, { kind: "text", text: `_ [arquivo anexado: ${part.filename || "sem nome"}]_` });
      }
      // step-start, step-finish, patch e compaction são ruído de execução: ignorados.
    }
  }

  if (!turns.length) return null;
  let title = session.title;
  if (!title || /^New session\b/i.test(title)) {
    title = firstUserText ? firstUserText.replace(/\s+/g, " ").slice(0, 70) : "Sem título";
  }
  return { title, directory: session.directory, first: session.timeCreated, last: session.timeUpdated, turns };
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
    `origem: ${JSON.stringify(c.directory)}`,
    `inicio: ${iso(c.first)}`,
    `fim: ${iso(c.last)}`,
    "agente: \"opencode\"",
    "---",
    "",
    `# ${c.title}`,
    "",
  ];
  const body = c.turns.map((t) =>
    `## ${t.who === "user" ? "Você" : "opencode"}\n\n${t.parts.map(renderPart).join("\n\n")}\n`);
  return head.concat(body).join("\n");
}

if (!fs.existsSync(SOURCE_DB)) {
  console.error(`Banco do opencode não encontrado: ${SOURCE_DB}`);
  process.exit(1);
}
const db = new DatabaseSync(SOURCE_DB, { readOnly: true });
const sessions = loadSessions(db);

if (flag("list")) {
  for (const s of sessions) {
    if (s.parentId) continue; // subagentes não viram conversa
    console.log(`${iso(s.timeCreated).slice(0, 10)}  ${s.id.slice(0, 20).padEnd(20)}  ${(s.title || "(sem título)").slice(0, 60).padEnd(60)}  ${s.directory}`);
  }
  process.exit(0);
}

const from = opt("from"), slug = opt("project");
if (!from || !slug) {
  console.error("Uso: node tools/import-opencode-chats.js --list | --from <match> --project <slug> [--no-tools] [--dry-run]");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(slug) || slug === "_template") {
  console.error("--project inválido: use apenas letras, números, '-' e '_' (sem barras ou '..').");
  process.exit(1);
}

const f = from.toLowerCase();
const selected = sessions.filter((s) =>
  !s.parentId && (s.directory.toLowerCase().includes(f) || s.id.toLowerCase().startsWith(f)));
if (!selected.length) {
  console.error(`Nenhuma sessão corresponde a "${from}" (diretório ou id). Veja --list.`);
  process.exit(1);
}

const dest = path.join(ROOT, "projects", slug);
if (!fs.existsSync(dest) && !flag("dry-run")) {
  fs.cpSync(path.join(ROOT, "projects", "_template"), dest, { recursive: true });
  console.log(`Projeto criado: projects/${slug}`);
}
const chatsDir = path.join(dest, "chats");
if (!flag("dry-run")) fs.mkdirSync(chatsDir, { recursive: true });

let ok = 0, skipped = 0, changed = 0;
for (const s of selected) {
  const c = convert(db, s, !flag("no-tools"));
  if (!c) { skipped++; continue; }
  const date = iso(c.first).slice(0, 10) || "sem-data";
  const shortId = slugify(s.id.slice(0, 12)); // só [a-z0-9-] no nome do arquivo gerado
  const name = `${date}-${slugify(c.title)}-${shortId}.md`;
  const out = path.join(chatsDir, name);
  const text = redact(render(c, s.id));
  const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  const state = before === null ? "nova" : before === text ? "sem mudança" : "atualizada";
  console.log(`${flag("dry-run") ? "[dry-run] " : ""}[${state}] ${name}  (${c.turns.length} turnos)`);
  if (!flag("dry-run") && state !== "sem mudança") {
    // O título da sessão pode mudar quando a conversa cresce: remove o arquivo antigo da mesma sessão.
    for (const old of fs.readdirSync(chatsDir)) {
      if (old !== name && old.endsWith(`-${shortId}.md`) && fs.readFileSync(path.join(chatsDir, old), "utf8").includes(`sessao: ${s.id}\n`)) {
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
console.log(`\n${ok} conversas processadas (${changed} novas ou atualizadas), ${skipped} ignoradas (vazias ou subagentes).`);
console.log(`Para ver o que ainda precisa de extração: node tools/extraction-state.js --project ${slug} status`);

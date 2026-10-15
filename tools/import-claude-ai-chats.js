#!/usr/bin/env node
// Converte o export de dados do claude.ai (conversas normais + chats do Claude Design) em .md
// dentro de projects/<slug>/chats/, no mesmo formato dos outros importadores do harness.
//
// O export vem em zips (Configurações > Privacidade > Exportar dados). Extraia, no mínimo:
//   conversations-000.zip  -> conversations.json          (chats normais)
//   design_chats-000.zip   -> design_chats/<uuid>.json    (chats do Claude Design)
//
// Como o export mistura TODOS os assuntos da conta (inclusive pessoais), este importador NUNCA importa
// tudo: é obrigatório escolher o que entra com --match, --design-project ou --id.
//
// Uso:
//   node tools/import-claude-ai-chats.js --export <pasta> --list
//   node tools/import-claude-ai-chats.js --export <pasta> --project <slug> --design-project "Framework de componentes" [--dry-run]
//   node tools/import-claude-ai-chats.js --export <pasta> --project <slug> --match "dispensa|DIS" [--no-tools] [--dry-run]
//   node tools/import-claude-ai-chats.js --export <pasta> --project <slug> --id <uuid>[,<uuid>...]
// <pasta> é a pasta que contém conversations.json e/ou design_chats/ (ou a pasta pai delas).
// --match filtra pelo título/resumo das conversas normais e pelo título/projeto dos chats de Design.

const fs = require("fs");
const path = require("path");

const { ROOT } = require("./lib/root");
const { redact } = require("./lib/redact");
const { slugify } = require("./lib/text");
const { renderChat } = require("./lib/chat-format");
const { writeChat } = require("./lib/chat-store");
const { flag, opt } = require("./lib/cli");
const { MAX_FILE } = require("./lib/limits");

const fail = (m) => { console.error(m); process.exit(1); };

const oneLine = (s, n = 120) => String(s || "").replace(/\s+/g, " ").slice(0, n);
const strip = (t) => String(t || "")
  .replace(/<(system-reminder|ide_[a-z_]+|command-[a-z-]+|local-command-[a-z-]+|project-harness|task-notification)>[\s\S]*?<\/\1>/g, "").trim();
const resultText = (c) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (x && x.type === "text" ? x.text : `[${x && x.type}]`)).join("\n") : c == null ? "" : JSON.stringify(c);
const hint = (i) => oneLine((i && (i.file_path || i.path || i.title || i.command || i.pattern || i.query || i.url || i.prompt || i.description || i.id)) || "");

// ---------- leitura do export ----------
const exportArg = opt("export");
if (!exportArg) fail("Informe --export <pasta> (a pasta extraída do export do claude.ai). Veja o cabeçalho do arquivo.");

function findIn(base, rel, depth = 3) {
  const direct = path.join(base, rel);
  if (fs.existsSync(direct)) return direct;
  if (depth <= 0) return null;
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return null; }
  for (const d of entries) { const r = findIn(path.join(base, d.name), rel, depth - 1); if (r) return r; }
  return null;
}
function readJson(f) {
  const st = fs.lstatSync(f);
  if (!st.isFile() || st.size > MAX_FILE) { console.error(`ignorado (symlink ou > 200 MB): ${f}`); return null; }
  try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, "")); } catch (e) { console.error(`JSON inválido: ${f} (${e.message})`); return null; }
}

const base = path.resolve(exportArg);
if (!fs.existsSync(base)) fail(`Pasta não encontrada: ${base}`);
const convFile = findIn(base, "conversations.json");
const designDir = findIn(base, "design_chats");
if (!convFile && !designDir) fail("Não achei conversations.json nem design_chats/ dentro da pasta informada.");

// Normaliza tudo para: { id, kind: "chat"|"design", title, project, created, updated, summary, turns }
// turns: [{ who: "user"|"assistant", parts: [{kind:"text"|"thinking"|"tool"|"note", ...}] }]
function pushTurn(turns, who, part) {
  const t = turns[turns.length - 1];
  if (t && t.who === who) t.parts.push(part); else turns.push({ who, parts: [part] });
}

function fromConversation(c) {
  const turns = [];
  for (const m of c.chat_messages || []) {
    const who = m.sender === "human" ? "user" : "assistant";
    const blocks = Array.isArray(m.content) && m.content.length ? m.content : [{ type: "text", text: m.text || "" }];
    let pending = null; // tool_use sem resultado ainda (o export não traz tool_use_id)
    for (const b of blocks) {
      if (b.type === "text") { const t = who === "user" ? strip(b.text) : String(b.text || "").trim(); if (t) pushTurn(turns, who, { kind: "text", text: t }); }
      else if (b.type === "thinking") { if ((b.thinking || "").trim()) pushTurn(turns, who, { kind: "thinking", text: b.thinking }); }
      else if (b.type === "tool_use") {
        pending = { kind: "tool", name: b.name || "tool", hint: hint(b.input), input: JSON.stringify(b.input || {}, null, 2), result: "", error: false };
        pushTurn(turns, who, pending);
      } else if (b.type === "tool_result") {
        if (pending) { pending.result = resultText(b.content); pending.error = !!b.is_error; pending = null; }
        else pushTurn(turns, who, { kind: "tool", name: b.name || "resultado", hint: "", input: "", result: resultText(b.content), error: !!b.is_error });
      } else if (b.type === "image") pushTurn(turns, who, { kind: "text", text: "_[imagem anexada]_" });
      else if (b.type === "document") pushTurn(turns, who, { kind: "text", text: `_[documento anexado: ${b.title || "sem nome"}]_` });
      // injected_prompt_block / token_budget: ruído do sistema, ignorados.
    }
    for (const a of m.attachments || []) if (a && a.file_name) pushTurn(turns, who, { kind: "text", text: `_[anexo: ${a.file_name}]_` });
  }
  return { id: c.uuid, kind: "chat", title: c.name || "", project: "", created: c.created_at, updated: c.updated_at, summary: c.summary || "", turns };
}

function fromDesign(d) {
  const turns = [];
  for (const m of d.messages || []) {
    const c = m.content && typeof m.content === "object" ? m.content : { content: String(m.content || ""), role: m.role };
    const who = c.role === "assistant" || m.role === "assistant" ? "assistant" : "user";
    const text = String(c.content || "").trim();
    if (c.kind === "chat-summary") { pushTurn(turns, "assistant", { kind: "note", text: `Resumo da conversa anterior:\n\n${text}` }); continue; }
    if (c.pill) { pushTurn(turns, who, { kind: "note", text }); continue; } // "Continuing from ..." e resultados automáticos
    if (c.kind === "question-record" && c.questionRecord && c.questionRecord.spec) {
      const s = c.questionRecord.spec;
      pushTurn(turns, "assistant", { kind: "text", text: `**Pergunta ao usuário:** ${s.title || ""}\n${s.prompt || ""}\n${(s.questions || []).map((q) => `- ${q.title}`).join("\n")}`.trim() });
      continue;
    }
    if (who === "user") {
      const atts = (c.attachments || []).filter((a) => a && ["image", "folder", "uploaded-folder", "text", "comment"].includes(a.type))
        .map((a) => a.name || a.type);
      const out = [strip(text), atts.length ? `_[anexos: ${atts.slice(0, 8).join(", ")}${atts.length > 8 ? ` +${atts.length - 8}` : ""}]_` : ""].filter(Boolean).join("\n\n");
      if (out) pushTurn(turns, "user", { kind: "text", text: out });
      continue;
    }
    // assistente: contentBlocks (texto, raciocínio, ferramentas) ou só o texto final
    const blocks = Array.isArray(c.contentBlocks) ? c.contentBlocks : [];
    let sawText = false;
    for (const b of blocks) {
      if (b.type === "text" && (b.text || "").trim()) { pushTurn(turns, "assistant", { kind: "text", text: b.text.trim() }); sawText = true; }
      else if (b.type === "thinking" && (b.text || "").trim()) pushTurn(turns, "assistant", { kind: "thinking", text: b.text });
      else if (b.type === "tool_call" && b.toolCall) {
        const t = b.toolCall;
        pushTurn(turns, "assistant", { kind: "tool", name: t.name || "tool", hint: hint(t.input), input: JSON.stringify(t.input || {}, null, 2), result: resultText(t.result ?? t.output ?? ""), error: !!t.error });
      } else if (b.type === "user_interjection" && b.message) pushTurn(turns, "user", { kind: "text", text: strip(b.message.content) });
      else if (b.type === "error") pushTurn(turns, "assistant", { kind: "note", text: `Erro: ${b.message || ""}` });
    }
    if (!sawText && text) pushTurn(turns, "assistant", { kind: "text", text });
  }
  return { id: d.uuid, kind: "design", title: d.title || "", project: (d.project && d.project.name) || "", created: d.created_at, updated: d.updated_at, summary: "", turns };
}

const items = [];
if (convFile) { const j = readJson(convFile); if (Array.isArray(j)) for (const c of j) items.push(fromConversation(c)); }
if (designDir) for (const f of fs.readdirSync(designDir).filter((n) => n.endsWith(".json"))) { const j = readJson(path.join(designDir, f)); if (j) items.push(fromDesign(j)); }

const label = (it) => (it.title && it.title !== "Chat" ? it.title : "") || (it.turns.find((t) => t.who === "user" && t.parts.some((p) => p.kind === "text"))?.parts.find((p) => p.kind === "text").text.replace(/\s+/g, " ").slice(0, 70) || "Sem título");

// ---------- --list ----------
if (flag("list")) {
  const rows = items.slice().sort((a, b) => String(a.created).localeCompare(String(b.created)));
  for (const it of rows) {
    console.log(`${(it.created || "").slice(0, 10)}  ${it.kind === "design" ? "design" : "chat  "}  ${String(it.turns.length).padStart(3)} turnos  ${it.id.slice(0, 8)}  ${oneLine(label(it), 60)}${it.project ? `  [${it.project}]` : ""}`);
  }
  console.log(`\n${rows.length} no total (${rows.filter((r) => r.kind === "design").length} de Design). Escolha com --match, --design-project ou --id.`);
  process.exit(0);
}

// ---------- seleção obrigatória ----------
const slug = opt("project");
if (!slug) fail("Uso: --export <pasta> --project <slug> (--match <regex> | --design-project <nome> | --id <uuid,...>) [--no-tools] [--dry-run] | --list");
if (!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(slug) || slug === "_template") fail("--project inválido: use apenas letras, números, '-' e '_'.");
const mt = opt("match"), dp = opt("design-project"), ids = opt("id");
if (!mt && !dp && !ids) fail("Escolha o que importar: --match, --design-project ou --id (o export mistura assuntos pessoais, nada é importado por padrão).");

let re = null;
if (mt) { try { re = new RegExp(mt, "i"); } catch (e) { fail(`--match inválido: ${e.message}`); } }
const idSet = ids ? new Set(ids.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) : null;
const dpl = dp ? dp.toLowerCase() : null;
const picked = items.filter((it) => {
  if (idSet && [...idSet].some((i) => it.id.toLowerCase().startsWith(i))) return true;
  if (dpl && it.kind === "design" && it.project.toLowerCase().includes(dpl)) return true;
  if (re && re.test(`${it.title}\n${it.project}\n${it.summary}`)) return true;
  return false;
});
if (!picked.length) fail("Nada casou com a seleção. Use --list para ver os títulos e ids.");

// ---------- render ----------
const withTools = !flag("no-tools");
function render(it) {
  const turns = it.turns.map((t) => ({ ...t, parts: t.parts.filter((p) => withTools || (p.kind !== "tool" && p.kind !== "thinking")) })).filter((t) => t.parts.length);
  const title = label(it).replace(/\s+/g, " ").slice(0, 80);
  const text = renderChat({
    title,
    sessionId: it.id,
    origin: it.kind === "design" ? `claude.ai/design${it.project ? ` · ${it.project}` : ""}` : "claude.ai",
    first: it.created,
    last: it.updated,
    agent: "claude",
    assistantLabel: "Claude",
  }, turns);
  return { text, n: turns.length };
}

const dest = path.join(ROOT, "projects", slug);
const dry = flag("dry-run");
if (!fs.existsSync(dest) && !dry) {
  fs.cpSync(path.join(ROOT, "projects", "_template"), dest, { recursive: true });
  console.log(`Projeto criado: projects/${slug}`);
}
const chatsDir = path.join(dest, "chats");
if (!dry) fs.mkdirSync(chatsDir, { recursive: true });

let changed = 0, skipped = 0;
for (const it of picked) {
  const { text, n } = render(it);
  if (!n) { skipped++; continue; }
  const date = (it.created || "").slice(0, 10) || "sem-data";
  const name = `${date}-${slugify(it.kind === "design" && it.project ? `design-${it.project}-${label(it)}` : label(it))}-${it.id.slice(0, 8)}.md`;
  const red = redact(text);
  const { state, removed } = writeChat({ chatsDir, name, sessionId: it.id, shortId: it.id.slice(0, 8), text: red, mtime: it.updated, dryRun: dry });
  console.log(`${dry ? "[dry-run] " : ""}[${state}] ${name}  (${n} turnos, ${it.kind})`);
  for (const old of removed) console.log(`  (renomeada; removido ${old})`);
  if (state !== "sem mudança") changed++;
}
console.log(`\n${picked.length - skipped} conversas processadas (${changed} novas ou atualizadas), ${skipped} vazias ignoradas.`);
console.log(`Para ver o que ainda precisa de extração: node tools/extraction-state.js --project ${slug} status`);

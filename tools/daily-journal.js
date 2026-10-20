// @ts-check
// Diário de atividade (telemetria das interações): lê projects/<slug>/chats/ e gera, SEM modelo e sem custo,
// um resumo por dia: o que foi pedido, em qual agente, que arquivos foram mexidos, comandos relevantes e histórias DIS-.
//   node tools/daily-journal.js [--project <slug>] [--since AAAA-MM-DD] [--stdout]   (padrão: projeto ativo)
// Saída: projects/<slug>/context/diario/AAAA-MM-DD.md e projects/<slug>/context/diario.md (índice).
// Usado também pelo sync (tools/sync.js e lib/sync-core.js) e pela interface (GET /api/project/:slug/journal, página /diario).
const fs = require("fs");
const path = require("path");
const { flag, opt, CliError, runAsScript } = require("./lib/cli");
const { ROOT } = require("./lib/root");
const { readMeta, stripFrontmatter, splitTurns } = require("./lib/chat-format");

const PATH_KEYS = ["AbsolutePath", "TargetFile", "file_path", "filePath", "path"];
const CMD_KEYS = ["CommandLine", "command"];
const WRITE_TOOLS = /edit|write|replace|create|notebook/i;
const NOTABLE_CMD = /\b(git (commit|push|merge|checkout)|mvn|npm|ng |docker|newman|curl)\b/;
const oneLine = (s, n = 140) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "?");
const dayOf = (iso) => (iso ? new Date(iso) : new Date(0)).toLocaleDateString("sv-SE"); // AAAA-MM-DD local

// Blocos :::tool nome | resumo ... --- entrada ... --- resultado ... :::
function toolCalls(body) {
  const calls = [];
  for (const m of body.matchAll(/^:::tool ([^|\n]+?)\s*(?:\|[^\n]*)?\n([\s\S]*?)^:::$/gm)) {
    const entrada = (m[2].split(/^--- resultado/m)[0] || "").replace(/^--- entrada\s*/m, "");
    let json = {};
    try { json = JSON.parse(entrada); } catch { /* entrada truncada: segue sem campos */ }
    const pick = (keys) => { for (const k of keys) if (typeof json[k] === "string") return json[k].replace(/^"|"$/g, ""); return ""; };
    calls.push({ tool: m[1].trim(), file: pick(PATH_KEYS), cmd: pick(CMD_KEYS) });
  }
  return calls;
}

// Histórias DIS- são as que o usuário citou nos pedidos, não as que apareceram em arquivos lidos pelo agente.
function readSessions(chatsDir, since) {
  const out = [];
  for (const f of fs.readdirSync(chatsDir).filter((n) => n.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(chatsDir, f), "utf8");
    const meta = readMeta(raw), body = stripFrontmatter(raw);
    const inicio = meta("inicio") || fs.statSync(path.join(chatsDir, f)).mtime.toISOString();
    if (since && dayOf(inicio) < since) continue;
    const turns = splitTurns(body).filter((t) => t.speaker === "Você");
    const calls = toolCalls(body);
    out.push({
      file: f, titulo: meta("titulo") || f, agente: meta("agente") || "?", inicio, fim: meta("fim") || inicio,
      prompts: turns.map((t) => oneLine(t.text)),
      edited: [...new Set(calls.filter((c) => c.file && WRITE_TOOLS.test(c.tool)).map((c) => c.file))],
      commands: [...new Set(calls.map((c) => c.cmd).filter((c) => NOTABLE_CMD.test(c)).map((c) => oneLine(c, 110)))],
      toolCount: calls.length,
      dis: [...new Set(turns.flatMap((t) => t.text.match(/\bDIS-\d+\b/g) || []))],
    });
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// [{ day, sessions: [...] }] do dia mais recente para o mais antigo.
function collect(slug, since) {
  const chatsDir = path.join(ROOT, "projects", slug, "chats");
  if (!fs.existsSync(chatsDir)) return [];
  const byDay = new Map();
  for (const s of readSessions(chatsDir, since)) {
    const d = dayOf(s.inicio);
    byDay.set(d, [...(byDay.get(d) || []), s]);
  }
  return [...byDay.keys()].sort().reverse().map((day) => ({ day, sessions: byDay.get(day) }));
}

const countPrompts = (ss) => ss.reduce((n, s) => n + s.prompts.length, 0);
const uniq = (arr) => [...new Set(arr)];

function renderDay({ day, sessions }) {
  const L = [`# Diário ${day}`, "", `${sessions.length} sessão(ões), ${countPrompts(sessions)} pedido(s).`, ""];
  const dis = uniq(sessions.flatMap((s) => s.dis));
  if (dis.length) L.push(`Histórias citadas: ${dis.join(", ")}`, "");
  for (const s of sessions) {
    const fim = dayOf(s.fim) === day ? hhmm(s.fim) : `${dayOf(s.fim)} ${hhmm(s.fim)}`;
    L.push(`## ${hhmm(s.inicio)}–${fim} · ${s.agente} · ${oneLine(s.titulo, 90)}`, "", `Fonte: chats/${s.file}`, "");
    L.push("Pedidos:", ...s.prompts.slice(0, 8).map((p) => `- ${p}`));
    if (s.prompts.length > 8) L.push(`- (+${s.prompts.length - 8} pedidos)`);
    if (s.edited.length) L.push("", "Arquivos alterados:", ...s.edited.slice(0, 25).map((f) => `- ${f}`), ...(s.edited.length > 25 ? [`- (+${s.edited.length - 25})`] : []));
    if (s.commands.length) L.push("", "Comandos relevantes:", ...s.commands.slice(0, 10).map((c) => `- \`${c}\``));
    L.push("");
  }
  return L.join("\n");
}

// Regrava os .md do projeto; devolve quantos dias foram gerados.
function write(slug, since) {
  const base = path.join(ROOT, "projects", slug);
  const all = collect(slug);
  const days = since ? all.filter((d) => d.day >= since) : all;
  const dir = path.join(base, "context", "diario");
  fs.mkdirSync(dir, { recursive: true });
  for (const d of days) fs.writeFileSync(path.join(dir, `${d.day}.md`), renderDay(d));

  const idx = ["# Diário de atividade", "", "Gerado por `tools/daily-journal.js` (a cada `sync`). Do mais recente para o mais antigo.", "",
    "| Dia | Sessões | Pedidos | Agentes | Histórias |", "|---|---|---|---|---|"];
  for (const d of all) {
    const ss = d.sessions;
    idx.push(`| [${d.day}](diario/${d.day}.md) | ${ss.length} | ${countPrompts(ss)} | ${uniq(ss.map((s) => s.agente)).join(", ")} | ${uniq(ss.flatMap((s) => s.dis)).join(", ")} |`);
  }
  fs.writeFileSync(path.join(base, "context", "diario.md"), idx.join("\n") + "\n");
  return days.length;
}

function activeSlug() {
  try {
    const want = fs.readFileSync(path.join(ROOT, "projects", ".active"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
    return want || "";
  } catch { return ""; }
}

function main(argv, io) {
  const slug = opt("project", argv) || activeSlug();
  if (!slug) throw new CliError("Informe --project <slug> (não há projeto ativo em projects/.active).");
  if (!fs.existsSync(path.join(ROOT, "projects", slug, "chats"))) throw new CliError(`Projeto sem chats: ${slug}`);
  if (flag("stdout", argv)) { io.log(collect(slug, opt("since", argv)).slice(0, 3).map(renderDay).join("\n---\n")); return; }
  io.log(`${write(slug, opt("since", argv))} dia(s) em projects/${slug}/context/diario (índice: context/diario.md)`);
}

if (require.main === module) runAsScript(main);
module.exports = { main, collect, write, renderDay };

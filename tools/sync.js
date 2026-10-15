#!/usr/bin/env node
// Atualiza ("refresh") as conversas dos 3 motores (Claude Code, Gemini/Antigravity e opencode) nos projetos
// que já existem em projects/, e mostra o que ficou pendente de extração. Nunca cria projetos novos.
//
// Uso:
//   node tools/sync.js                          todos os motores, todos os projetos
//   node tools/sync.js --project dai            só um projeto
//   node tools/sync.js --engine claude,opencode só alguns motores (claude | gemini | opencode)
//   node tools/sync.js --dry-run                mostra o que mudaria, sem gravar
//   node tools/sync.js --no-extract             não roda a extração local (sem modelo) nos projetos que mudaram
//
// Como as conversas são associadas a projetos: pelo nome do projeto no caminho da pasta de trabalho
// (ex.: .../git/57multimarcas). Para nomes diferentes, crie projects/.sources.json com apelidos:
//   { "saude-prontuario": ["prontuario"] }

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { existingSlugs, matchers, projectFromPath } = require("./lib/projects");
const state = require("./lib/state");

const ROOT = path.resolve(__dirname, "..");
const T = (f) => path.join(__dirname, f);
const CLAUDE_ROOT = path.join(os.homedir(), ".claude", "projects");
const GEMINI_ROOT = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");
const OPENCODE_DB = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

const { flag, opt } = require("./lib/cli");
const DRY = flag("dry-run");
const fail = (m) => { console.error(m); process.exit(1); };

const ENGINES = ["claude", "gemini", "opencode"];
const engines = opt("engine") ? opt("engine").split(",").map((s) => s.trim().toLowerCase()) : ENGINES;
if (engines.some((e) => !ENGINES.includes(e))) fail(`--engine inválido. Use: ${ENGINES.join(", ")}`);

const only = opt("project");
const slugs = existingSlugs();
if (only && !slugs.includes(only)) fail(`Projeto "${only}" não existe em projects/. Existentes: ${slugs.join(", ")}`);
const want = (slug) => !only || slug === only;
const ms = matchers();

// Roda um importador em memória (sem processo filho) e devolve as contagens por estado.
// Os importadores são carregados só quando o motor é usado (o do opencode exige o node:sqlite do Node 22.13+).
const QUIET = { log() {} };
function call(importerFile, argv, opts) {
  try {
    const r = require(importerFile).run([...argv, ...(DRY ? ["--dry-run"] : [])], QUIET, opts);
    return { ok: true, n: { nova: r.nova, atualizada: r.atualizada, igual: r.igual }, err: "", porProjeto: r.porProjeto };
  } catch (e) {
    return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: String(e && e.message).split("\n")[0] };
  }
}

const rows = []; // { engine, slug, nova, atualizada, igual, erro }
const unmatched = {}; // motor -> nomes sem projeto
const add = (engine, slug, r) => rows.push({ engine, slug, ...r.n, erro: r.ok ? "" : r.err });
const skip = (engine, name) => ((unmatched[engine] ||= new Set()).add(name));

// ---- Claude Code: uma pasta de ~/.claude/projects por diretório de trabalho
function syncClaude() {
  if (!fs.existsSync(CLAUDE_ROOT)) return "indisponível (sem ~/.claude/projects)";
  const bySlug = new Map();
  for (const d of fs.readdirSync(CLAUDE_ROOT, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const slug = projectFromPath(d.name, ms);
    if (!slug) { skip("claude", d.name); continue; }
    if (want(slug)) (bySlug.get(slug) || bySlug.set(slug, []).get(slug)).push(d.name);
  }
  for (const [slug, dirs] of bySlug) {
    const sum = { ok: true, n: { nova: 0, atualizada: 0, igual: 0 }, err: "" };
    for (const d of dirs) {
      const r = call("./import-claude-code-chats", ["--from", path.join(CLAUDE_ROOT, d), "--project", slug]);
      for (const k of Object.keys(sum.n)) sum.n[k] += r.n[k];
      if (!r.ok) { sum.ok = false; sum.err = r.err; }
    }
    add("claude", slug, sum);
  }
}

// ---- Gemini/Antigravity: o importador detecta o projeto de cada sessão; uma passada só, restrita aos projetos que existem
function syncGemini() {
  if (!fs.existsSync(GEMINI_ROOT)) return "indisponível (sem ~/.gemini/antigravity-ide/brain)";
  const wanted = slugs.filter(want);
  const r = call("./import-gemini-chats", [], { onlyProjects: new Set(wanted) });
  for (const slug of wanted) {
    const n = (r.porProjeto && r.porProjeto[slug]) || { nova: 0, atualizada: 0, igual: 0 };
    add("gemini", slug, { ok: r.ok, n, err: r.err });
  }
}

// ---- opencode: lê só session (diretório) para mapear; as sessões de cada projeto entram numa única execução
function syncOpencode() {
  if (!fs.existsSync(OPENCODE_DB)) return "indisponível (sem opencode.db)";
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(OPENCODE_DB, { readOnly: true });
  const sessions = db.prepare("SELECT id, directory FROM session WHERE parent_id IS NULL").all();
  db.close();
  const bySlug = new Map();
  for (const s of sessions) {
    const slug = projectFromPath(s.directory, ms);
    if (!slug) { skip("opencode", path.basename(String(s.directory || "").replace(/[\\/]+$/, "")) || s.directory); continue; }
    if (want(slug)) (bySlug.get(slug) || bySlug.set(slug, []).get(slug)).push(s.id);
  }
  for (const [slug, ids] of bySlug) add("opencode", slug, call("./import-opencode-chats", ["--project", slug], { sessionIds: ids }));
}

const fns = { claude: syncClaude, gemini: syncGemini, opencode: syncOpencode };
console.log(`Sincronizando ${engines.join(", ")} em ${only || `${slugs.length} projeto(s)`}${DRY ? " [dry-run]" : ""}...\n`);
for (const e of engines) {
  let msg;
  try { msg = fns[e](); } catch (x) { msg = `falhou: ${String(x.message).split("\n")[0]}`; }
  if (msg) console.log(`${e.padEnd(9)} ${msg}`);
}

if (rows.length) {
  console.log("\nmotor     projeto                               novas  atualizadas  sem mudança");
  for (const r of rows) {
    console.log(`${r.engine.padEnd(9)} ${r.slug.padEnd(36)} ${String(r.nova).padStart(5)}  ${String(r.atualizada).padStart(11)}  ${String(r.igual).padStart(11)}${r.erro ? `   ⚠ ${r.erro.slice(0, 80)}` : ""}`);
  }
}
for (const [e, set] of Object.entries(unmatched)) {
  const list = [...set];
  console.log(`\n${e}: ${list.length} pasta(s) sem projeto correspondente (ignoradas): ${list.slice(0, 6).join(", ")}${list.length > 6 ? ", ..." : ""}`);
}
if (Object.keys(unmatched).length) console.log("Para associar uma delas a um projeto, adicione um apelido em projects/.sources.json.");

// ---- extração local (sem modelo) nos projetos que mudaram, e resumo do que falta analisar
const changed = new Set(rows.filter((r) => r.nova + r.atualizada > 0).map((r) => r.slug));
if (!DRY && !flag("no-extract")) {
  for (const slug of changed) {
    const r = spawnSync(process.execPath, ["--no-warnings", T("extract-artifacts.js"), "--project", slug], { encoding: "utf8" });
    console.log(`\nextração local ${slug}: ${r.status === 0 ? "atualizada" : "falhou (" + (r.stderr || "").trim().split("\n").pop() + ")"}`);
  }
}

console.log("\nProjeto                               conversas  em dia  novas  alteradas  (para analisar)");
for (const slug of slugs.filter(want)) {
  const list = state.scan(slug);
  const c = (s) => list.filter((x) => x.status === s).length;
  console.log(`${slug.padEnd(37)} ${String(list.length).padStart(9)}  ${String(c("ok")).padStart(6)}  ${String(c("nova")).padStart(5)}  ${String(c("alterada")).padStart(9)}`);
}
console.log("\nPara analisar o que está pendente: peça ao agente a skill extrair-artefatos, ou rode node tools/extract-artifacts.js --project <slug> --llm (usa cota).");

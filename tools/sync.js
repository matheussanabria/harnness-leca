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

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
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

// Executa um importador e conta [nova] / [atualizada] / [sem mudança] na saída.
function run(script, a) {
  const r = spawnSync(process.execPath, ["--no-warnings", T(script), ...a, ...(DRY ? ["--dry-run"] : [])], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "") + "\n" + (r.stderr || "");
  const n = { nova: 0, atualizada: 0, igual: 0 };
  for (const m of out.matchAll(/\[(nova|atualizada|sem mudança)\]/g)) n[m[1] === "sem mudança" ? "igual" : m[1]]++;
  return { ok: r.status === 0, n, err: (r.stderr || r.stdout || "").trim().split("\n").pop() };
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
      const r = run("import-claude-code-chats.js", ["--from", path.join(CLAUDE_ROOT, d), "--project", slug]);
      for (const k of Object.keys(sum.n)) sum.n[k] += r.n[k];
      if (!r.ok) { sum.ok = false; sum.err = r.err; }
    }
    add("claude", slug, sum);
  }
}

// ---- Gemini/Antigravity: o importador detecta o projeto de cada sessão; filtramos por projeto existente
function syncGemini() {
  if (!fs.existsSync(GEMINI_ROOT)) return "indisponível (sem ~/.gemini/antigravity-ide/brain)";
  for (const slug of slugs.filter(want)) add("gemini", slug, run("import-gemini-chats.js", ["--project", slug]));
}

// ---- opencode: lê só session (diretório) para mapear; cada sessão é importada pelo id
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
  for (const [slug, ids] of bySlug) {
    const sum = { ok: true, n: { nova: 0, atualizada: 0, igual: 0 }, err: "" };
    for (const id of ids) {
      const r = run("import-opencode-chats.js", ["--from", id, "--project", slug]);
      for (const k of Object.keys(sum.n)) sum.n[k] += r.n[k];
      if (!r.ok) { sum.ok = false; sum.err = r.err; }
    }
    add("opencode", slug, sum);
  }
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

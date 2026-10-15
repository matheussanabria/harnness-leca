// @ts-check
// Sincronização sob demanda de conversas dos 3 motores (Claude Code, Gemini/Antigravity e OpenCode).
// Pode ser acionado pela interface (botões de atalho) ou por outras rotinas.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { matchers, projectFromPath } = require("./projects");
const state = require("./state");

const QUIET = /** @type {any} */ ({ log() {} });

function syncClaudeForProject(slug, ms, dryRun = false) {
  const claudeRoot = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(claudeRoot)) return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: "indisponível (sem ~/.claude/projects)" };
  const dirs = [];
  try {
    for (const d of fs.readdirSync(claudeRoot, { withFileTypes: true }).filter((x) => x.isDirectory())) {
      const s = projectFromPath(d.name, ms);
      if (s === slug) dirs.push(d.name);
    }
  } catch (err) {
    return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: String(err && err.message) };
  }
  const sum = { ok: true, n: { nova: 0, atualizada: 0, igual: 0 }, err: "" };
  const importer = require("../import-claude-code-chats");
  for (const d of dirs) {
    try {
      const r = importer.run(["--from", path.join(claudeRoot, d), "--project", slug, ...(dryRun ? ["--dry-run"] : [])], QUIET);
      sum.n.nova += r.nova || 0;
      sum.n.atualizada += r.atualizada || 0;
      sum.n.igual += r.igual || 0;
    } catch (e) {
      sum.ok = false;
      sum.err = String(e && e.message).split("\n")[0];
    }
  }
  return sum;
}

function syncGeminiForProject(slug, ms, dryRun = false) {
  const geminiRoot = path.join(os.homedir(), ".gemini", "antigravity-ide", "brain");
  if (!fs.existsSync(geminiRoot)) return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: "indisponível (sem brain)" };
  const importer = require("../import-gemini-chats");
  try {
    const r = importer.run([...(dryRun ? ["--dry-run"] : [])], QUIET, /** @type {any} */ ({ onlyProjects: new Set([slug]) }));
    const n = (r.porProjeto && r.porProjeto[slug]) || { nova: r.nova || 0, atualizada: r.atualizada || 0, igual: r.igual || 0 };
    return { ok: true, n, err: "" };
  } catch (e) {
    return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: String(e && e.message).split("\n")[0] };
  }
}

function syncOpencodeForProject(slug, ms, dryRun = false) {
  const dbPath = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");
  if (!fs.existsSync(dbPath)) return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: "indisponível (sem opencode.db)" };
  let ids = [];
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const sessions = db.prepare("SELECT id, directory FROM session WHERE parent_id IS NULL").all();
    db.close();
    for (const s of sessions) {
      const pSlug = projectFromPath(s.directory, ms);
      if (pSlug === slug) ids.push(s.id);
    }
  } catch (e) {
    return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: String(e && e.message).split("\n")[0] };
  }
  if (!ids.length) return { ok: true, n: { nova: 0, atualizada: 0, igual: 0 }, err: "" };
  const importer = require("../import-opencode-chats");
  try {
    const r = importer.run(["--project", slug, ...(dryRun ? ["--dry-run"] : [])], QUIET, /** @type {any} */ ({ sessionIds: ids }));
    return { ok: true, n: { nova: r.nova || 0, atualizada: r.atualizada || 0, igual: r.igual || 0 }, err: "" };
  } catch (e) {
    return { ok: false, n: { nova: 0, atualizada: 0, igual: 0 }, err: String(e && e.message).split("\n")[0] };
  }
}

/**
 * Sincroniza conversas de um projeto específico ou de todos os motores solicitados.
 * @param {{ slug: string, engines?: string[] | string, dryRun?: boolean, noExtract?: boolean }} param0
 */
function syncProject({ slug, engines = ["claude", "gemini", "opencode"], dryRun = false, noExtract = false }) {
  const ms = matchers();
  const fns = {
    claude: () => syncClaudeForProject(slug, ms, dryRun),
    gemini: () => syncGeminiForProject(slug, ms, dryRun),
    opencode: () => syncOpencodeForProject(slug, ms, dryRun),
  };

  const selectedEngines = Array.isArray(engines) ? engines : [engines];
  const list = selectedEngines.filter((e) => fns[e]);
  if (!list.length) list.push("claude", "gemini", "opencode");

  const results = [];
  let totalNova = 0;
  let totalAtualizada = 0;
  let totalIgual = 0;

  for (const eng of list) {
    const res = fns[eng]();
    totalNova += res.n.nova;
    totalAtualizada += res.n.atualizada;
    totalIgual += res.n.igual;
    results.push({
      engine: eng,
      nova: res.n.nova,
      atualizada: res.n.atualizada,
      igual: res.n.igual,
      erro: res.ok ? "" : res.err,
    });
  }

  if (!dryRun) {
    try { state.writeTable(slug); } catch {}
    if (!noExtract && (totalNova + totalAtualizada > 0)) {
      try {
        const extScript = path.join(__dirname, "..", "extract-artifacts.js");
        if (fs.existsSync(extScript)) {
          spawnSync(process.execPath, ["--no-warnings", extScript, "--project", slug], { encoding: "utf8", windowsHide: true, timeout: 10000 });
        }
      } catch {}
    }
  }

  let mensagem = "";
  if (totalNova > 0 || totalAtualizada > 0) {
    const partes = [];
    if (totalNova > 0) partes.push(`${totalNova} nova${totalNova > 1 ? "s" : ""}`);
    if (totalAtualizada > 0) partes.push(`${totalAtualizada} atualizada${totalAtualizada > 1 ? "s" : ""}`);
    mensagem = `Sincronização concluída: ${partes.join(" e ")} conversa${(totalNova + totalAtualizada) > 1 ? "s" : ""}!`;
  } else {
    mensagem = `Tudo em dia! Nenhuma nova conversa encontrada (${list.join(", ")}).`;
  }

  return {
    ok: true,
    slug,
    engines: list,
    totalNova,
    totalAtualizada,
    totalIgual,
    detalhes: results,
    mensagem,
  };
}

module.exports = {
  syncProject,
  syncClaudeForProject,
  syncGeminiForProject,
  syncOpencodeForProject,
};

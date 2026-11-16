// @ts-check
// Import of a claude.ai data export from the UI: list what the export holds, then import the picked chats
// into one project. Both reuse tools/import-claude-ai-chats.js, so the files match the CLI output exactly.
const fs = require("fs");
const path = require("path");
const { getProjects, slugs, send, readJsonBody } = require("../config");
const importer = require("../../../tools/import-claude-ai-chats");
const { CliError } = require("../../../tools/lib/cli");

const ID_RE = /^[0-9a-f-]{8,36}$/i;
const QUIET = { log() {} };
let running = false;

/** Maps the 8-char id prefix of every chat file in projects/<slug>/chats to the projects that hold it. */
function importedIndex() {
  /** @type {Map<string, string[]>} */
  const idx = new Map();
  for (const slug of slugs()) {
    let names = [];
    try { names = fs.readdirSync(path.join(getProjects(), slug, "chats")); } catch { continue; }
    for (const n of names) {
      const m = /-([0-9a-f]{8})\.md$/i.exec(n);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const list = idx.get(key) || [];
      if (!list.includes(slug)) list.push(slug);
      idx.set(key, list);
    }
  }
  return idx;
}

async function body(req, res) {
  try {
    return await readJsonBody(req);
  } catch {
    send(res, 400, { error: "Invalid JSON" });
    return null;
  }
}

/** POST /api/claude-ai-import/list { exportPath } */
async function apiClaudeAiList({ req, res }) {
  const b = await body(req, res);
  if (!b) return;
  const exportPath = String(b.exportPath || "").trim();
  if (!exportPath) return send(res, 400, { error: "Informe a pasta do export do claude.ai." });
  let items;
  try {
    items = importer.loadItems(exportPath, QUIET);
  } catch (err) {
    return send(res, 400, { error: (err && err.message) || String(err) });
  }
  const idx = importedIndex();
  const rows = items
    .filter((it) => it.turns.length)
    .map((it) => ({
      id: it.id,
      kind: it.kind,
      title: importer.label(it).replace(/\s+/g, " ").slice(0, 120),
      project: it.project,
      created: it.created,
      updated: it.updated,
      turns: it.turns.length,
      importedIn: idx.get(String(it.id).slice(0, 8).toLowerCase()) || [],
    }))
    .sort((a, b2) => String(b2.updated || b2.created).localeCompare(String(a.updated || a.created)));
  return send(res, 200, { total: rows.length, items: rows });
}

/** POST /api/project/:slug/claude-ai-import { exportPath, ids, withTools } */
async function apiClaudeAiImport({ req, res, params: [slug] }) {
  if (!slugs().includes(slug)) return send(res, 404, { error: "projeto não encontrado" });
  const b = await body(req, res);
  if (!b) return;
  const exportPath = String(b.exportPath || "").trim();
  const ids = Array.isArray(b.ids) ? b.ids.map((s) => String(s).trim()).filter((s) => ID_RE.test(s)) : [];
  if (!exportPath) return send(res, 400, { error: "Informe a pasta do export do claude.ai." });
  if (!ids.length) return send(res, 400, { error: "Selecione ao menos uma conversa." });
  if (running) return send(res, 409, { error: "Já há uma importação em andamento." });
  running = true;
  const lines = [];
  try {
    const argv = ["--export", exportPath, "--project", slug, "--id", ids.join(",")];
    if (b.withTools === false) argv.push("--no-tools");
    const r = importer.run(argv, { log: (l) => lines.push(String(l)) });
    const changed = r.nova + r.atualizada;
    const mensagem = `${changed} conversa(s) importada(s) ou atualizada(s) do claude.ai (${r.nova} novas, ${r.atualizada} atualizadas, ${r.igual} sem mudança).`;
    return send(res, 200, { ...r, mensagem, log: lines.slice(-60) });
  } catch (err) {
    if (err instanceof CliError) return send(res, 400, { error: err.message });
    console.error("[claude-ai-import]", (err && /** @type {any} */ (err).stack) || err);
    return send(res, 500, { error: "Falha ao importar. O detalhe está no terminal do servidor." });
  } finally {
    running = false;
  }
}

module.exports = { apiClaudeAiList, apiClaudeAiImport, importedIndex };

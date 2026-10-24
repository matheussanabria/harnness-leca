// @ts-check
// Leitores de fontes com sqlite e rollout: Codex, OpenCode e cwd do Antigravity.
// Bancos abertos SOMENTE LEITURA, so colunas de id/cwd/data (nunca titulo, preview ou mensagens).
// Rollouts do Codex: so stat; o id vem do nome e o cwd da tabela `threads`.
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { THRESHOLDS, ENGINES } = require("./presence-config");

const ROLLOUT_RE = /^rollout-.*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @template T
 * @param {string} file
 * @param {(db: DatabaseSync) => T} fn
 * @returns {T | null} null se o banco nao existe
 */
function withReadOnlyDb(file, fn) {
  if (!fs.existsSync(file)) return null;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** @param {number} ms @returns {string[]} pastas YYYY/MM/DD (local e UTC) que cobrem a janela */
function rolloutDayDirs(nowMs) {
  const dirs = new Set();
  const pad = (n) => String(n).padStart(2, "0");
  for (let back = 0; back * DAY_MS <= THRESHOLDS.noRecentSignalMs + DAY_MS; back += 1) {
    const d = new Date(nowMs - back * DAY_MS);
    dirs.add(path.join(String(d.getFullYear()), pad(d.getMonth() + 1), pad(d.getDate())));
    dirs.add(path.join(String(d.getUTCFullYear()), pad(d.getUTCMonth() + 1), pad(d.getUTCDate())));
  }
  return [...dirs];
}

/**
 * Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl (mtime) + threads.cwd (state_5.sqlite).
 * Threads filhas de subagente (thread_spawn_edges) nao entram. Sem cwd conhecido, o hint e vazio.
 * @param {string} codexHome
 * @param {number} nowMs
 * @returns {import("./presence-config").Candidate[]}
 */
function readCodex(codexHome, nowMs) {
  /** @type {import("./presence-config").Candidate[]} */
  const out = [];
  for (const rel of rolloutDayDirs(nowMs)) {
    const dir = path.join(codexHome, "sessions", rel);
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const match = ROLLOUT_RE.exec(name);
      if (!match) continue;
      let mtime;
      try {
        mtime = fs.statSync(path.join(dir, name)).mtimeMs;
      } catch {
        continue;
      }
      if (nowMs - mtime >= THRESHOLDS.noRecentSignalMs) continue;
      out.push({ engine: ENGINES.codex, nativeId: match[1], signalMs: mtime, hint: "" });
    }
  }
  if (!out.length) return out;
  const found = withReadOnlyDb(path.join(codexHome, "state_5.sqlite"), (db) => {
    const withEdges = db.prepare(
      "SELECT cwd, EXISTS(SELECT 1 FROM thread_spawn_edges e WHERE e.child_thread_id = threads.id) AS child FROM threads WHERE id = ?",
    );
    const plain = db.prepare("SELECT cwd, 0 AS child FROM threads WHERE id = ?");
    return out.map((item) => {
      try {
        return withEdges.get(item.nativeId);
      } catch {
        return plain.get(item.nativeId);
      }
    });
  });
  if (!found) return out;
  return out.filter((item, i) => {
    const row = found[i];
    if (row) item.hint = String(row.cwd || "");
    return !(row && Number(row.child) === 1);
  });
}

/**
 * OpenCode: tabela `session`, sessoes de topo, nao arquivadas. A coluna real e `time_updated` (ms);
 * versoes antigas usam `updated_at` (segundos): ambas sao aceitas.
 * @param {string} dbFile
 * @param {number} nowMs
 * @returns {import("./presence-config").Candidate[]}
 */
function readOpenCode(dbFile, nowMs) {
  const rows = withReadOnlyDb(dbFile, (db) => {
    const cols = new Set(db.prepare("PRAGMA table_info(session)").all().map((c) => String(c.name)));
    const legacy = !cols.has("time_updated") && cols.has("updated_at");
    const column = legacy ? "updated_at" : "time_updated";
    const archived = cols.has("time_archived") ? " AND time_archived IS NULL" : "";
    const since = nowMs - THRESHOLDS.noRecentSignalMs;
    const bound = legacy ? Math.floor(since / 1000) : since;
    return db.prepare(
      `SELECT id, directory, ${column} AS updated FROM session WHERE parent_id IS NULL${archived} AND ${column} > ?`,
    ).all(bound).map((r) => ({ ...r, updated: legacy ? Number(r.updated) * 1000 : Number(r.updated) }));
  });
  return (rows || []).map((r) => ({
    engine: ENGINES.opencode,
    nativeId: String(r.id),
    signalMs: Number(r.updated),
    hint: String(r.directory || ""),
  }));
}

/** @param {string} uriList JSON de workspace_uris @returns {string} caminhos decodificados, separados por espaco */
function decodeWorkspaces(uriList) {
  try {
    const list = JSON.parse(uriList);
    if (!Array.isArray(list)) return "";
    return list.map((u) => decodeURIComponent(String(u).replace(/^file:\/+/i, ""))).join(" ");
  } catch {
    return "";
  }
}

/**
 * Preenche o hint (workspace) e remove subconversas do Antigravity, via conversation_summaries.db.
 * Conversa fora do banco fica sem hint (vira "nao atribuida" no scanner; nada e inventado).
 * @param {import("./presence-config").Candidate[]} candidates
 * @param {string[]} dbFiles
 * @returns {import("./presence-config").Candidate[]}
 */
function attachAntigravityWorkspaces(candidates, dbFiles) {
  if (!candidates.length) return candidates;
  const known = new Map();
  for (const file of dbFiles) {
    withReadOnlyDb(file, (db) => {
      const stmt = db.prepare("SELECT workspace_uris, parent_conversation_id FROM conversation_summaries WHERE conversation_id = ?");
      for (const item of candidates) {
        if (known.has(item.nativeId)) continue;
        const row = stmt.get(item.nativeId);
        if (row) known.set(item.nativeId, row);
      }
    });
  }
  return candidates.filter((item) => {
    const row = known.get(item.nativeId);
    if (!row) return true;
    if (row.parent_conversation_id) return false;
    item.hint = decodeWorkspaces(String(row.workspace_uris || ""));
    return true;
  });
}

module.exports = { readCodex, readOpenCode, attachAntigravityWorkspaces, decodeWorkspaces };

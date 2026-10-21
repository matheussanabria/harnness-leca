// @ts-check
// Event Store do Harness (EP-09.02) — log append-only persistente, com cursor, idempotência
// e replay. Usa o SQLite nativo do Node (node:sqlite), sem acrescentar dependência.
//
// O log é a fonte de verdade das projeções: reiniciar o servidor não perde nada,
// e qualquer projeção pode ser reconstruída a partir do log.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { ROOT } = require("../../../../tools/lib/root");

const DB_REL = "coordination/events.sqlite";
const MAX_EVENTS = 20000;

/** Alias aceitos na entrada para o evento canonico (migracao sem reescrever historico). */
const TYPE_ALIASES = {
  "execution.completed": "execution.succeeded",
  "execution.finished": "execution.succeeded",
  "workflow.transition": "workflow.transitioned",
  "approval.approved": "approval.resolved",
  "approval.rejected": "approval.resolved",
};

const TRUST_VALUES = new Set(["observed", "inferred", "declared"]);

/**
 * @typedef {Object} HarnessEvent
 * @property {string} id
 * @property {string} type
 * @property {string} at
 * @property {{ provider: string, kind: string }} source
 * @property {string} trust
 * @property {string | null} projectId
 * @property {string | null} sessionId
 * @property {string | null} executionId
 * @property {object} payload
 */

/**
 * @param {string} slug
 * @returns {string}
 */
function dbPath(slug) {
  return path.join(ROOT, "projects", slug, DB_REL);
}

/** @type {Map<string, DatabaseSync>} */
const connections = new Map();

/**
 * Abre (ou reaproveita) a conexao do log de um projeto.
 * @param {string} slug
 * @returns {DatabaseSync}
 */
function openStore(slug) {
  const cached = connections.get(slug);
  if (cached) return cached;
  const file = dbPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      at TEXT NOT NULL,
      source_provider TEXT NOT NULL DEFAULT '',
      source_kind TEXT NOT NULL DEFAULT '',
      trust TEXT NOT NULL DEFAULT 'observed',
      project_id TEXT,
      session_id TEXT,
      execution_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS events_type ON events(type);
    CREATE INDEX IF NOT EXISTS events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS events_execution ON events(execution_id);
  `);
  connections.set(slug, db);
  return db;
}

/**
 * Normaliza um evento de entrada: completa campos, aplica aliases e gera o cursor.
 * @param {any} input
 * @param {string} projectId
 * @returns {HarnessEvent}
 */
function normalizeEvent(input, projectId) {
  const rawType = String(input?.type || "event").trim();
  const type = TYPE_ALIASES[rawType] || rawType;
  const trust = TRUST_VALUES.has(String(input?.trust)) ? String(input.trust) : "observed";
  return {
    id: String(input?.id || crypto.randomUUID()),
    type,
    at: String(input?.at || new Date().toISOString()),
    source: {
      provider: String(input?.source?.provider || "harness").trim(),
      kind: String(input?.source?.kind || "internal").trim(),
    },
    trust,
    projectId: String(input?.projectId || projectId || "") || null,
    sessionId: String(input?.sessionId || "") || null,
    executionId: String(input?.executionId || "") || null,
    payload: input?.payload && typeof input.payload === "object" ? input.payload : {},
  };
}

/**
 * Grava um evento. Reprocessar o mesmo `id` nao duplica nada.
 * @param {string} slug
 * @param {any} input
 * @returns {{ event: HarnessEvent, cursor: string, duplicated: boolean }}
 */
function appendEvent(slug, input) {
  const db = openStore(slug);
  const event = normalizeEvent(input, slug);
  const existing = db.prepare("SELECT seq FROM events WHERE id = ?").get(event.id);
  if (existing) {
    return { event, cursor: String(existing.seq), duplicated: true };
  }
  const info = db
    .prepare(
      `INSERT INTO events (id, type, at, source_provider, source_kind, trust, project_id, session_id, execution_id, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      event.type,
      event.at,
      event.source.provider,
      event.source.kind,
      event.trust,
      event.projectId,
      event.sessionId,
      event.executionId,
      JSON.stringify(event.payload),
    );
  const seq = Number(info.lastInsertRowid);
  prune(db);
  return { event, cursor: String(seq), duplicated: false };
}

/**
 * @param {DatabaseSync} db
 */
function prune(db) {
  const total = Number(db.prepare("SELECT COUNT(*) AS total FROM events").get().total || 0);
  if (total <= MAX_EVENTS) return;
  const cut = Number(db.prepare("SELECT seq FROM events ORDER BY seq DESC LIMIT 1 OFFSET ?").get(MAX_EVENTS).seq);
  db.prepare("DELETE FROM events WHERE seq <= ?").run(cut);
}

/**
 * Lê eventos a partir de um cursor (exclusivo), em ordem.
 * @param {string} slug
 * @param {{ cursor?: string, limit?: number, types?: string[], sessionId?: string }} [options]
 * @returns {{ events: HarnessEvent[], cursor: string }}
 */
function readEvents(slug, options = {}) {
  const db = openStore(slug);
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
  const since = Math.max(Number(options.cursor) || 0, 0);
  const clauses = ["seq > ?"];
  const params = [since];
  if (options.types && options.types.length) {
    clauses.push(`type IN (${options.types.map(() => "?").join(",")})`);
    params.push(...options.types);
  }
  if (options.sessionId) {
    clauses.push("session_id = ?");
    params.push(options.sessionId);
  }
  const rows = db
    .prepare(`SELECT * FROM events WHERE ${clauses.join(" AND ")} ORDER BY seq ASC LIMIT ?`)
    .all(...params, limit);
  const events = rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    at: String(row.at),
    source: { provider: String(row.source_provider || ""), kind: String(row.source_kind || "") },
    trust: String(row.trust || "observed"),
    projectId: row.project_id ? String(row.project_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    executionId: row.execution_id ? String(row.execution_id) : null,
    payload: JSON.parse(String(row.payload || "{}")),
  }));
  const last = rows.length ? String(rows[rows.length - 1].seq) : String(since);
  return { events, cursor: last };
}

/**
 * @param {string} slug
 * @returns {{ total: number, byType: Record<string, number>, firstCursor: string, lastCursor: string }}
 */
function storeStats(slug) {
  const db = openStore(slug);
  const total = Number(db.prepare("SELECT COUNT(*) AS total FROM events").get().total || 0);
  const byType = {};
  for (const row of db.prepare("SELECT type, COUNT(*) AS total FROM events GROUP BY type").all()) {
    byType[String(row.type)] = Number(row.total);
  }
  const first = db.prepare("SELECT seq FROM events ORDER BY seq ASC LIMIT 1").get();
  const last = db.prepare("SELECT seq FROM events ORDER BY seq DESC LIMIT 1").get();
  return {
    total,
    byType,
    firstCursor: first ? String(first.seq) : "0",
    lastCursor: last ? String(last.seq) : "0",
  };
}

/**
 * Fecha a conexao do projeto (usado em testes e no encerramento do servidor).
 * @param {string} slug
 */
function closeStore(slug) {
  const db = connections.get(slug);
  if (!db) return;
  try {
    db.close();
  } catch {
    /* ja fechada */
  }
  connections.delete(slug);
}

module.exports = {
  DB_REL,
  MAX_EVENTS,
  TYPE_ALIASES,
  openStore,
  appendEvent,
  readEvents,
  storeStats,
  closeStore,
  normalizeEvent,
};

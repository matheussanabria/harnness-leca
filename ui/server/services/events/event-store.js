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
const { ID_FIELDS, normalizeEnvelope, rowToEvent } = require("./event-envelope");
const { migrate } = require("./event-migrations");
const retention = require("./event-retention");

const DB_REL = "coordination/events.sqlite";
/** Teto de eventos OPERACIONAIS por projeto; `usage.observed` tem regra propria (event-retention.js). */
const MAX_EVENTS = retention.RETENTION.operationalMax;

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
 * Envelope v1 (aditivo, anulavel): schemaVersion, ingestedAt, relation e os ids de ID_FIELDS.
 * @property {number} [schemaVersion]
 * @property {string | null} [ingestedAt]
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
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
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
    ...normalizeEnvelope(input),
  };
}

const ENVELOPE_COLUMN_LIST = ID_FIELDS.map(([, column]) => column);
const INSERT_SQL = `INSERT INTO events (id, type, at, source_provider, source_kind, trust, project_id, session_id, execution_id, payload,
  schema_version, ingested_at, relation, ${ENVELOPE_COLUMN_LIST.join(", ")})
  VALUES (${new Array(13 + ENVELOPE_COLUMN_LIST.length).fill("?").join(", ")})
  ON CONFLICT DO NOTHING`;

/**
 * Grava um evento. Reprocessar o mesmo `id` ou a mesma `idempotencyKey` (por source.provider)
 * e um no-op que devolve o evento ja armazenado. ON CONFLICT DO NOTHING deixa a unicidade
 * no banco, sem corrida entre SELECT e INSERT (ADR-TEL-004).
 * @param {string} slug
 * @param {any} input
 * @returns {{ event: HarnessEvent, cursor: string, duplicated: boolean }}
 */
function appendEvent(slug, input) {
  const db = openStore(slug);
  const event = /** @type {Record<string, any>} */ (normalizeEvent(input, slug));
  const info = db
    .prepare(INSERT_SQL)
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
      event.schemaVersion,
      event.ingestedAt,
      event.relation,
      ...ID_FIELDS.map(([key]) => event[key]),
    );
  if (Number(info.changes) === 0) {
    const row = db.prepare("SELECT * FROM events WHERE id = ?").get(event.id)
      || db.prepare("SELECT * FROM events WHERE source_provider = ? AND idempotency_key = ?").get(event.source.provider, event.idempotencyKey);
    if (row) return { event: /** @type {HarnessEvent} */ (rowToEvent(row)), cursor: String(row.seq), duplicated: true };
  }
  retention.afterInsert(db, event.type);
  return { event: /** @type {HarnessEvent} */ (event), cursor: String(Number(info.lastInsertRowid)), duplicated: false };
}

/**
 * Lê eventos a partir de um cursor (exclusivo), em ordem.
 * @param {string} slug
 * @param {{ cursor?: string, limit?: number, types?: string[], sessionId?: string }} [options]
 * @returns {{ events: HarnessEvent[], cursor: string, cursors: string[] }} `cursors[i]` e o cursor do evento i
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
  const events = rows.map((row) => /** @type {HarnessEvent} */ (rowToEvent(row)));
  const last = rows.length ? String(rows[rows.length - 1].seq) : String(since);
  return { events, cursor: last, cursors: rows.map((row) => String(row.seq)) };
}

/**
 * Detecta lacuna depois de um cursor: o primeiro evento sobrevivente nao e o cursor + 1, ou seja,
 * eventos foram podados e um cliente com esse cursor perdeu historico.
 * @param {string} slug
 * @param {string | number} cursor
 * @returns {{ gap: boolean, firstCursor: string }} firstCursor = primeiro cursor sobrevivente apos `cursor`
 */
function gapAfter(slug, cursor) {
  const since = Math.max(Number(cursor) || 0, 0);
  const next = openStore(slug).prepare("SELECT MIN(seq) AS seq FROM events WHERE seq > ?").get(since);
  if (!next || next.seq === null || next.seq === undefined) return { gap: false, firstCursor: String(since) };
  return { gap: Number(next.seq) > since + 1, firstCursor: String(next.seq) };
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
  retention.forget(db);
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
  gapAfter,
  storeStats,
  closeStore,
  normalizeEvent,
};

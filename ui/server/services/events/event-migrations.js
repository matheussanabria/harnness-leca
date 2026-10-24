// @ts-check
// Migracao de esquema do event log, versionada por PRAGMA user_version.
//
// Escolha: colunas nuláveis via ALTER TABLE ... ADD COLUMN (em vez de uma coluna JSON de envelope).
// Motivo (menor risco): ADD COLUMN sem DEFAULT so altera o catalogo, nao reescreve a tabela e
// preserva todas as linhas; as colunas permitem indice e UNIQUE parcial para idempotencia
// (uma coluna JSON exigiria indice sobre expressao e deixaria o dedup fora do banco).
// Idempotencia: cada coluna so e criada se ausente (PRAGMA table_info), tudo dentro de uma
// transacao com BEGIN IMMEDIATE; reabrir ou repetir a migracao nao tem efeito.
// Linhas antigas ficam com as colunas novas em null (nao ha backfill de idempotencyKey: o
// dedup por `id` continua cobrindo-as).
const { SCHEMA_VERSION, ENVELOPE_COLUMNS } = require("./event-envelope");

const BASE_DDL = `
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
`;

/** @param {import("node:sqlite").DatabaseSync} db */
function readUserVersion(db) {
  return Number(db.prepare("PRAGMA user_version").get().user_version || 0);
}

/**
 * Migracao 1: envelope v1 (colunas nulaveis, indice de run e UNIQUE parcial de idempotencia).
 * @param {import("node:sqlite").DatabaseSync} db
 */
function migrateToV1(db) {
  const present = new Set(db.prepare("PRAGMA table_info(events)").all().map((col) => String(col.name)));
  for (const column of ENVELOPE_COLUMNS) {
    if (!present.has(column.name)) db.exec(`ALTER TABLE events ADD COLUMN ${column.name} ${column.type}`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS events_run ON events(run_id);
    CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency
      ON events(source_provider, idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);
}

/**
 * Cria o esquema base (idempotente) e aplica as migracoes pendentes.
 * Banco com user_version maior que o conhecido e deixado como esta (nunca rebaixa).
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {number} user_version final
 */
function migrate(db) {
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(BASE_DDL);
  if (readUserVersion(db) >= SCHEMA_VERSION) return readUserVersion(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    // Reavalia dentro do lock: outro processo pode ter migrado entre a leitura e o BEGIN.
    if (readUserVersion(db) < 1) {
      migrateToV1(db);
      db.exec("PRAGMA user_version = 1");
    }
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* transacao ja encerrada */
    }
    throw err;
  }
  return readUserVersion(db);
}

module.exports = { migrate, readUserVersion, BASE_DDL };

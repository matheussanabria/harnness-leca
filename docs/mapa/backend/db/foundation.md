---
domain: backend
module: db
feature: foundation
summary: SQLite foundation (EP-17.01): shared connection, forward-only migrations, table owners, repo helpers, health route.
paths: [ui/server/db/connection.js, ui/server/db/migrate.js, ui/server/db/repo-base.js, ui/server/db/owners.js, ui/server/db/README.md, ui/server/db/migrations/001-init.js, ui/server/routes/db.routes.js, tools/lib/db-client.js, tests/db-connection.test.js, tests/db-migrate.test.js, tests/db-health.test.js, tests/db-boundary.test.js, tests/db-owners.test.js, tests/db-open-busy.test.js]
keywords: [sqlite, database, harness.sqlite, migrations, owners, wal, health, repository, ep-17]
updated: 2026-11-19
---
# Database foundation

One local database, `data/harness.sqlite` (override `HARNESS_DB_PATH`, git-ignored). Each process opens its own connection through `connection.js`; one owner per table in `owners.js`; any process may migrate (the runner holds `BEGIN IMMEDIATE`). The legacy `events.sqlite` is untouched.

| File | Responsibility |
|---|---|
| `ui/server/db/connection.js` | Resolves the path, creates the data dir, applies WAL (the switch is retried while the database is busy, because `busy_timeout` does not cover it), `busy_timeout=5000` and `foreign_keys=ON`, migrates on open; `getDb`/`closeDb` shared connection and an in-memory test fixture. |
| `ui/server/db/migrate.js` | Forward-only runner: `schema_migrations`, `user_version` mirror, gaps allowed, refuses unknown migrations, atomic across concurrent processes. |
| `ui/server/db/repo-base.js` | `transaction(fn)` (IMMEDIATE, savepoints when nested), prepared statement cache, JSON column helpers. |
| `ui/server/db/owners.js` | Table to owner process map (`web`, `host`, `cli`); `ownersOf`, `canWrite`. |
| `ui/server/db/README.md` | Write discipline and local-disk rule. |
| `ui/server/db/migrations/001-init.js` | Creates the `meta` table. |
| `ui/server/routes/db.routes.js` | `GET /api/db/health`: schema version, size, WAL status. |
| `tools/lib/db-client.js` | `openCliDatabase` for CLIs: same pragmas and migration check as the server. |
| `tests/db-connection.test.js` | Pragmas, path override, foreign keys, repo-base helpers. |
| `tests/db-migrate.test.js` | Idempotence, gaps, refusal of unknown migrations, rollback, two concurrent processes. |
| `tests/db-open-busy.test.js` | Opening waits for another process's lock; the WAL-switch retry (growing pauses, timeout, non-busy errors not retried) with a database that fails on purpose. |
| `tests/db-health.test.js` | Health endpoint over the HTTP server with a temp database. |
| `tests/db-boundary.test.js` | Static scan: `node:sqlite` only in the db module, db-client and an explicit allowlist. |
| `tests/db-owners.test.js` | Every table created by a migration has an owner. |

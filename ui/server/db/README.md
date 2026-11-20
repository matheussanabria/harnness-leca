# ui/server/db

SQLite system of record (EP-17, ADR-012). One file, `data/harness.sqlite` (override with `HARNESS_DB_PATH`), opened with `node:sqlite`.

## Write discipline

Several processes may open the database: the web server, the engine host and CLIs in `tools/`. WAL mode already serializes writers at the file level, so these rules protect data ownership, not the file.

1. Each process opens its own connection, always through `connection.js` (CLIs use `tools/lib/db-client.js`). Nothing else requires `node:sqlite`; `tests/db-boundary.test.js` enforces it.
2. One owner per table, declared in `owners.js`. Only the owner writes; other processes read or ask the owner's API. `tests/db-owners.test.js` checks that every table created by a migration has an owner.
3. Short transactions with `BEGIN IMMEDIATE` (`repo-base.js` `transaction(fn)`). No network, model or CLI call inside a transaction. `busy_timeout` is 5000 ms.
4. Any process may apply migrations. The runner works inside `BEGIN IMMEDIATE`: the first opener migrates, the others wait, then see the migrated schema and apply nothing. A database holding a migration this code does not know is refused.
5. `synchronous = NORMAL` (the usual WAL setting): a process crash loses nothing; a power loss may drop the last commits but never corrupts the file. FULL cost ~13 ms per small commit (EP-23.02).
6. Keep the database on a local disk. Never place it in a synced or network folder (OneDrive, Dropbox, SMB share): WAL locking is unreliable there and can corrupt data.

## Migrations

Files `migrations/NNN-name.js` export `up(db)` and never open their own transaction. Numbers are reserved per story in the EP-17 README; gaps are allowed, forward-only, no down migrations. Each migration that creates a table adds its owner to `owners.js` in the same commit.

## Files

| File | Role |
|---|---|
| `connection.js` | Path resolution, pragmas (WAL, busy_timeout, foreign_keys), `openDatabase`, shared `getDb`, in-memory test fixture |
| `migrate.js` | Forward-only runner, `schema_migrations`, `user_version` |
| `repo-base.js` | `transaction`, prepared statement cache, JSON helpers |
| `owners.js` | Table to owner process map |
| `migrations/` | Numbered schema changes |

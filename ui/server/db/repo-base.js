// @ts-check
// Repository helpers (EP-17.01 RF3): short IMMEDIATE transactions, a prepared statement cache and JSON column
// helpers. Repositories live in ui/server/db/repos/ and receive the connection by injection.
// Keep transactions short: no network, model or CLI call inside transaction(fn).

/**
 * @param {import("node:sqlite").DatabaseSync} db
 */
function createRepoBase(db) {
  /** @type {Map<string, import("node:sqlite").StatementSync>} */
  const cache = new Map();
  let depth = 0;

  /** @param {string} sql */
  function prepare(sql) {
    let stmt = cache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      cache.set(sql, stmt);
    }
    return stmt;
  }

  /**
   * Runs fn inside BEGIN IMMEDIATE (outermost) or a SAVEPOINT (nested). Rolls back and rethrows on error.
   * fn must be synchronous: an async fn would leave the transaction open across awaits.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  function transaction(fn) {
    const nested = depth > 0;
    const savepoint = `sp_${depth}`;
    db.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
    depth += 1;
    try {
      const result = fn();
      if (result && typeof (/** @type {any} */ (result)).then === "function") {
        throw new Error("transaction(fn) requires a synchronous function");
      }
      depth -= 1;
      db.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
      return result;
    } catch (error) {
      depth -= 1;
      db.exec(nested ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : "ROLLBACK");
      throw error;
    }
  }

  /** @param {unknown} value */
  const toJson = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

  /**
   * @param {unknown} text
   * @param {any} [fallback]
   */
  function fromJson(text, fallback = null) {
    if (typeof text !== "string" || text === "") return fallback;
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  return { db, prepare, transaction, toJson, fromJson };
}

module.exports = { createRepoBase };

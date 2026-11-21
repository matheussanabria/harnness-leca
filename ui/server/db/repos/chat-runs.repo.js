// @ts-check
// Chat run journal repository (EP-23.02, migration 011). Writes are idempotent by run_id + seq, so a retried
// batch never duplicates an event. Receives the connection by injection; never requires node:sqlite.
const { createRepoBase } = require("../repo-base");

/** @typedef {"running" | "completed" | "stopped" | "interrupted"} RunStatus */
/** @typedef {{ runId: string, project: string|null, chatId: string|null, engine: string|null, status: RunStatus, startedAt: string, endedAt: string|null, lastSeq: number, resumedFrom: string|null }} StoredRun */
/** @typedef {{ seq: number, type?: string, [key: string]: any }} JournalEvent */

const TERMINAL_TYPES = ["done", "error"];

/** @param {any} row @returns {StoredRun} */
const toRun = (row) => ({
  runId: String(row.run_id),
  project: row.project ?? null,
  chatId: row.chat_id ?? null,
  engine: row.engine ?? null,
  status: /** @type {RunStatus} */ (row.status),
  startedAt: String(row.started_at),
  endedAt: row.ended_at ?? null,
  lastSeq: Number(row.last_seq),
  resumedFrom: row.resumed_from ?? null,
});

/** @param {import("node:sqlite").DatabaseSync} db */
function createChatRunsRepo(db) {
  const base = createRepoBase(db);
  const { prepare, transaction, toJson, fromJson } = base;

  /**
   * Records a new run as running. A second call for the same id is ignored.
   * @param {{ runId: string, project?: string|null, chatId?: string|null, engine?: string|null, startedAt?: string, resumedFrom?: string|null }} run
   */
  function startRun({ runId, project = null, chatId = null, engine = null, startedAt = new Date().toISOString(), resumedFrom = null }) {
    prepare(`INSERT OR IGNORE INTO chat_runs (run_id, project, chat_id, engine, status, started_at, resumed_from)
      VALUES (?, ?, ?, ?, 'running', ?, ?)`).run(runId, project, chatId, engine, startedAt, resumedFrom);
  }

  /**
   * Appends a batch of events in one short transaction. Events already stored (same seq) are skipped.
   * @param {string} runId @param {JournalEvent[]} events
   * @returns {number} rows actually inserted
   */
  function appendEvents(runId, events) {
    if (!events.length) return 0;
    return transaction(() => {
      const insert = prepare("INSERT OR IGNORE INTO chat_run_events (run_id, seq, type, payload) VALUES (?, ?, ?, ?)");
      let inserted = 0;
      let maxSeq = -1;
      for (const event of events) {
        const info = insert.run(runId, event.seq, typeof event.type === "string" ? event.type : null, String(toJson(event)));
        inserted += Number(info.changes);
        if (event.seq > maxSeq) maxSeq = event.seq;
      }
      prepare("UPDATE chat_runs SET last_seq = MAX(last_seq, ?) WHERE run_id = ?").run(maxSeq, runId);
      return inserted;
    });
  }

  /**
   * Closes a running run. A run already closed keeps its first final status.
   * @param {string} runId @param {Exclude<RunStatus, "running">} status @param {string} [endedAt]
   */
  function endRun(runId, status, endedAt = new Date().toISOString()) {
    prepare("UPDATE chat_runs SET status = ?, ended_at = ? WHERE run_id = ? AND status = 'running'").run(status, endedAt, runId);
  }

  /** @param {string} runId @returns {StoredRun | null} */
  function getRun(runId) {
    const row = prepare("SELECT * FROM chat_runs WHERE run_id = ?").get(runId);
    return row ? toRun(row) : null;
  }

  /**
   * Events with seq >= from, in order.
   * @param {string} runId @param {number} [from]
   * @returns {JournalEvent[]}
   */
  function readFrom(runId, from = 0) {
    return prepare("SELECT payload FROM chat_run_events WHERE run_id = ? AND seq >= ? ORDER BY seq")
      .all(runId, from)
      .map((row) => fromJson(row.payload, null))
      .filter(Boolean);
  }

  /** @param {string} runId @returns {boolean} the run produced a done or error event */
  function hasTerminalEvent(runId) {
    const marks = TERMINAL_TYPES.map(() => "?").join(", ");
    return Boolean(prepare(`SELECT 1 AS ok FROM chat_run_events WHERE run_id = ? AND type IN (${marks}) LIMIT 1`).get(runId, ...TERMINAL_TYPES));
  }

  /**
   * On boot no run of the previous process is still alive: every running row becomes interrupted.
   * @param {string} [endedAt] @returns {number} runs marked
   */
  function markInterruptedOnBoot(endedAt = new Date().toISOString()) {
    return Number(prepare("UPDATE chat_runs SET status = 'interrupted', ended_at = ? WHERE status = 'running'").run(endedAt).changes);
  }

  /**
   * Deletes runs (and their events, by cascade) that ended before the cutoff. Running rows are never pruned.
   * @param {string} endedBefore ISO timestamp @returns {number} runs deleted
   */
  function prune(endedBefore) {
    return transaction(() => {
      prepare(`DELETE FROM chat_run_events WHERE run_id IN
        (SELECT run_id FROM chat_runs WHERE status != 'running' AND ended_at < ?)`).run(endedBefore);
      return Number(prepare("DELETE FROM chat_runs WHERE status != 'running' AND ended_at < ?").run(endedBefore).changes);
    });
  }

  return { startRun, appendEvents, endRun, getRun, readFrom, hasTerminalEvent, markInterruptedOnBoot, prune };
}

module.exports = { createChatRunsRepo, TERMINAL_TYPES };

// @ts-check
// Chat runs that outlive the HTTP connection. A phone that locks the screen or switches app drops the
// SSE stream; the run keeps going, its events are buffered with a sequence number, and the client
// reattaches (GET /api/chat/attach) to replay what it missed. A run with nobody attached for
// RUN_GRACE_MS is aborted so an abandoned tab cannot keep an engine busy forever.
// EP-23.02: events are written to the run journal (SQLite) BEFORE subscribers see them. Events pushed in the
// same tick are flushed together in one short transaction; the memory buffer is only the live cache.
const { getJournal, scrubEvent, stoppedEvent } = require("./chat-run-journal.service");

const RUN_GRACE_MS = Number(process.env.HARNESS_CHAT_GRACE_MS) || 10 * 60 * 1000;
const KEEP_AFTER_END_MS = 2 * 60 * 1000;
const MAX_BUFFER = 5000;
const SSE_HEARTBEAT_MS = 15000;

/** @typedef {{ seq: number, [key: string]: any }} RunEvent */
/** @typedef {{ project?: string|null, engine?: string|null, chatId?: string|null, resumedFrom?: string|null }} RunMeta */
/** @typedef {{ abort: () => void, onEnd?: (completed: boolean) => void, meta?: RunMeta }} RunHooks */

/** @type {Map<string, ReturnType<typeof createRun>>} */
const runs = new Map();

/** @param {string} where @param {unknown} error */
const journalWarn = (where, error) => console.warn(`[chat-run-registry] journal ${where}:`, (error && /** @type {any} */ (error).message) || error);

/**
 * @param {string} id
 * @param {RunHooks} hooks
 */
function createRun(id, { abort, onEnd, meta = {} }) {
  const journal = getJournal();
  if (journal) {
    try { journal.startRun({ runId: id, project: meta.project ?? null, chatId: meta.chatId ?? id, engine: meta.engine ?? null, resumedFrom: meta.resumedFrom ?? null }); }
    catch (error) { journalWarn("start", error); }
  }
  /** @type {RunEvent[]} */
  const events = [];
  /** @type {RunEvent[]} pushed but not yet journaled nor published */
  let pending = [];
  let flushScheduled = false;
  /** @type {Set<(event: RunEvent) => void>} */
  const subscribers = new Set();
  /** @type {Set<() => void>} */
  const closers = new Set();
  let seq = 0;
  let finished = false;
  let completed = false;
  let sawTerminal = false;
  /** @type {NodeJS.Timeout | null} */
  let graceTimer = null;

  const clearGrace = () => { if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; } };
  const armGrace = () => {
    clearGrace();
    if (finished || subscribers.size > 0) return;
    graceTimer = setTimeout(() => end(false, "idle"), RUN_GRACE_MS);
    graceTimer.unref?.();
  };

  /** Write the pending batch to the journal, then publish it to the memory buffer and the subscribers. */
  function flush() {
    flushScheduled = false;
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    if (journal) {
      try { journal.appendEvents(id, batch.map((event) => scrubEvent(event))); }
      catch (error) { journalWarn("append", error); }
    }
    for (const event of batch) {
      events.push(event);
      if (events.length > MAX_BUFFER) events.shift();
      for (const sub of subscribers) sub(event);
    }
  }

  /**
   * @param {boolean} ok
   * @param {"user"|"idle"|"restart"} [reason] why a run ended without an answer (EP-23.04); "restart" is a forced host restart (EP-23.05)
   */
  function end(ok, reason = "user") {
    if (finished) return;
    // EP-23.04: a run cut short without a final event gets one, so a late attach (or the journal replay) shows it
    // as interrupted with its partial answer instead of reattaching until it gives up.
    if (!ok && !sawTerminal) pending.push({ ...stoppedEvent(reason), seq: seq++ });
    flush();
    finished = true;
    completed = ok;
    clearGrace();
    if (journal) {
      try { journal.endRun(id, ok ? "completed" : reason === "restart" ? "interrupted" : "stopped"); }
      catch (error) { journalWarn("end", error); }
    }
    if (!ok) { try { abort(); } catch {} }
    for (const close of [...closers]) close();
    try { onEnd?.(ok); } catch {}
    const keep = setTimeout(() => runs.delete(id), KEEP_AFTER_END_MS);
    keep.unref?.();
  }

  return {
    id,
    get finished() { return finished; },
    get completed() { return completed; },
    /** @param {Record<string, any>} data */
    push(data) {
      if (finished) return;
      if (data && (data.type === "done" || data.type === "error")) sawTerminal = true;
      pending.push({ ...data, seq: seq++ });
      if (!flushScheduled) {
        flushScheduled = true;
        setImmediate(flush);
      }
    },
    /** The run produced its final event (done or error): close the streams and keep the buffer for late reattach. */
    finish: () => end(true),
    /** Explicit stop (user pressed stop): abort the engine now. */
    stop: () => end(false),
    /** Forced host restart (EP-23.05): the run ends as interrupted, with its partial answer kept. */
    interrupt: () => end(false, "restart"),
    /**
     * Attach a response: replay events with seq >= from, then follow live until the run ends or the response closes.
     * @param {import("http").ServerResponse} res @param {number} from
     */
    attach(res, from) {
      /** @param {RunEvent} event */
      const write = (event) => { if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`); };
      for (const event of events) if (event.seq >= from) write(event);
      const closeRes = () => { if (!res.writableEnded && !res.destroyed) res.end(); };
      if (finished) return closeRes();
      clearGrace();
      subscribers.add(write);
      closers.add(closeRes);
      // Remote access (Cloudflare tunnel) returns 524 after ~100 s without bytes; keep the line warm.
      const heartbeat = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n"); }, SSE_HEARTBEAT_MS);
      res.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(write);
        closers.delete(closeRes);
        armGrace();
      });
    },
  };
}

/** @param {string} id */
const getRun = (id) => runs.get(id) || null;

/**
 * @param {string} id @param {RunHooks} hooks
 */
function registerRun(id, hooks) {
  const run = createRun(id, hooks);
  runs.set(id, run);
  return run;
}

/** Ids of the runs still in progress in this process (engine host: GET /runs). */
const listActiveRuns = () => [...runs.values()].filter((run) => !run.finished).map((run) => run.id);

/** Tests only: forget every run held in memory, as a restarted process would. */
const resetRunsForTests = () => runs.clear();

module.exports = { registerRun, getRun, listActiveRuns, resetRunsForTests, RUN_GRACE_MS };

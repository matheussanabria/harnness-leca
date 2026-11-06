// @ts-check
// Chat runs that outlive the HTTP connection. A phone that locks the screen or switches app drops the
// SSE stream; the run keeps going, its events are buffered with a sequence number, and the client
// reattaches (GET /api/chat/attach) to replay what it missed. A run with nobody attached for
// RUN_GRACE_MS is aborted so an abandoned tab cannot keep an engine busy forever.
const RUN_GRACE_MS = Number(process.env.HARNESS_CHAT_GRACE_MS) || 10 * 60 * 1000;
const KEEP_AFTER_END_MS = 2 * 60 * 1000;
const MAX_BUFFER = 5000;
const SSE_HEARTBEAT_MS = 15000;

/** @typedef {{ seq: number, [key: string]: any }} RunEvent */

/** @type {Map<string, ReturnType<typeof createRun>>} */
const runs = new Map();

/**
 * @param {string} id
 * @param {{ abort: () => void, onEnd?: (completed: boolean) => void }} hooks
 */
function createRun(id, { abort, onEnd }) {
  /** @type {RunEvent[]} */
  const events = [];
  /** @type {Set<(event: RunEvent) => void>} */
  const subscribers = new Set();
  /** @type {Set<() => void>} */
  const closers = new Set();
  let seq = 0;
  let finished = false;
  let completed = false;
  /** @type {NodeJS.Timeout | null} */
  let graceTimer = null;

  const clearGrace = () => { if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; } };
  const armGrace = () => {
    clearGrace();
    if (finished || subscribers.size > 0) return;
    graceTimer = setTimeout(() => end(false), RUN_GRACE_MS);
    graceTimer.unref?.();
  };

  /** @param {boolean} ok */
  function end(ok) {
    if (finished) return;
    finished = true;
    completed = ok;
    clearGrace();
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
      const event = { ...data, seq: seq++ };
      events.push(event);
      if (events.length > MAX_BUFFER) events.shift();
      for (const sub of subscribers) sub(event);
    },
    /** The run produced its final event (done or error): close the streams and keep the buffer for late reattach. */
    finish: () => end(true),
    /** Explicit stop (user pressed stop): abort the engine now. */
    stop: () => end(false),
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
 * @param {string} id @param {{ abort: () => void, onEnd?: (completed: boolean) => void }} hooks
 */
function registerRun(id, hooks) {
  const run = createRun(id, hooks);
  runs.set(id, run);
  return run;
}

module.exports = { registerRun, getRun, RUN_GRACE_MS };

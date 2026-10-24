// @ts-check
// Bounded, incremental ingest of Claude Code transcripts into usage.observed events (plan T3.1).
//
// Per tick: discover files (stat only), attribute each to a project by its cwd-slug folder, read at most
// maxBytesPerTick bytes / publish at most maxCallsPerTick calls, newest files first, then persist the
// checkpoints. The rest continues on the next tick (the runtime shortens the delay while a backlog remains).
//
// Streaming duplicates: lines of one message.id are contiguous. They are merged in memory into one open
// call per file; the call is published when a different call starts, or when the file has been quiet for
// quietMs at EOF. The persisted offset is HELD at the first line of the open call, so a restart replays
// that call from its start; the idempotencyKey 'usage|claude|<callId>' makes the replay a no-op.
const os = require("os");
const path = require("path");
const { ingestEvent } = require("../events/event-ingest");
const cfg = require("./usage-config");
const { discover } = require("./file-discovery");
const { readWindow } = require("./transcript-reader");
const { createCheckpointStore } = require("./checkpoint-store");
const { extractCall, mergeCall, toEventBody, mightCarryUsage } = require("./call-normalizer");
const { costOf } = require("./usage-cost");

/** @typedef {{ pos: number, size: number, mtimeMs: number, open: null | { call: import("./call-normalizer").CallRecord, start: number }, heldAt: number }} FileState */

function defaultCoordinationDir() {
  const { ROOT } = require("../../../../tools/lib/root");
  return (/** @type {string} */ slug) => path.join(ROOT, "projects", slug, "coordination");
}

/**
 * @param {{ root?: string, resolveProject?: (hint: string) => string | null, publish?: (slug: string, body: any) => { duplicated: boolean },
 *   estimator?: ((input: any) => any) | null, now?: () => number, host?: string, coordinationDir?: (slug: string) => string,
 *   limits?: Partial<typeof cfg.LIMITS> }} [options]
 */
function createUsageIngestor(options = {}) {
  const L = { ...cfg.LIMITS, ...options.limits };
  const root = options.root || cfg.defaultRoot();
  const now = options.now || Date.now;
  const publish = options.publish || ingestEvent;
  const host = options.host || os.hostname();
  const checkpoints = createCheckpointStore(options.coordinationDir || defaultCoordinationDir(), L.checkpointTtlMs);
  const cache = {
    cold: new Map(), coldAfterMs: L.coldAfterMs, coldSweepMs: L.coldSweepMs,
    // Idle files (nothing left to read, or no project) are not re-statted on every tick.
    isSettled: (/** @type {string} */ file, /** @type {number} */ size, /** @type {string} */ hint) => {
      const st = states.get(file);
      return st ? st.pos >= size && !st.open : attribute(hint) === null;
    },
  };
  let resolveProject = options.resolveProject || null;
  /** @type {Map<string, FileState>} */
  const states = new Map();
  /** @type {Map<string, string | null>} */
  const slugByHint = new Map();
  const stats = {
    ticks: 0, callsPublished: 0, duplicates: 0, linesMerged: 0, linesRead: 0, linesSkipped: 0, linesUnparsable: 0,
    linesOversized: 0, filesTracked: 0, filesUnmatched: 0, resets: 0, bytesRead: 0, lastTickBytes: 0, lastTickMs: 0,
    lastTickAt: /** @type {string | null} */ (null), backlog: false, failed: 0, errors: 0,
  };
  const settled = () => stats.callsPublished + stats.duplicates + stats.failed;

  function attribute(/** @type {string} */ hint) {
    if (!slugByHint.has(hint)) {
      if (!resolveProject) resolveProject = require("../external-presence/presence-scanner").createDefaultResolver();
      slugByHint.set(hint, hint ? /** @type {Function} */ (resolveProject)(hint) : null);
    }
    return slugByHint.get(hint) || null;
  }

  /** @returns {FileState} */
  function stateFor(/** @type {import("./file-discovery").TranscriptFile} */ f, /** @type {string} */ slug, /** @type {number} */ nowMs) {
    let st = states.get(f.file);
    if (!st) {
      const cp = checkpoints.get(slug, f.file);
      if (cp) st = { pos: cp.offset, size: cp.size, mtimeMs: cp.mtimeMs, open: null, heldAt: -1 };
      // First backfill: files older than the window are not read; only bytes appended later count.
      else if (nowMs - f.mtimeMs >= L.backfillDays * 86400000) st = { pos: f.size, size: f.size, mtimeMs: f.mtimeMs, open: null, heldAt: -1 };
      else st = { pos: 0, size: 0, mtimeMs: 0, open: null, heldAt: -1 };
      states.set(f.file, st);
    }
    // Truncation or replacement: smaller than before, or an older mtime than the one already consumed.
    if (f.size < st.size || f.size < st.pos || (st.size > 0 && f.mtimeMs < st.mtimeMs)) {
      stats.resets += 1;
      st.pos = 0;
      st.open = null;
      st.heldAt = -1;
    }
    return st;
  }

  function closeCall(/** @type {FileState} */ st, /** @type {string} */ slug, /** @type {string} */ sessionId) {
    const call = st.open && st.open.call;
    st.open = null;
    if (!call) return;
    const cost = costOf({ provider: cfg.PROVIDER, model: call.model, tokens: call.tokens, at: call.at }, options.estimator);
    try {
      const result = publish(slug, toEventBody(call, { nativeSessionId: sessionId, slug, host, cost }));
      if (result.duplicated) stats.duplicates += 1;
      else stats.callsPublished += 1;
    } catch {
      stats.failed += 1; // dropped for this run; a poison call must not block the file forever
    }
  }

  function handleLine(/** @type {{ text: string, start: number, end: number }} */ line, /** @type {FileState} */ st,
    /** @type {string} */ slug, /** @type {string} */ sessionId) {
    stats.linesRead += 1;
    st.pos = line.end;
    if (!mightCarryUsage(line.text)) {
      stats.linesSkipped += 1;
      return;
    }
    const r = extractCall(line.text);
    if (r.status === "unparsable") stats.linesUnparsable += 1;
    else if (r.status === "skip") stats.linesSkipped += 1;
    else if (st.open && st.open.call.callId === r.call.callId) {
      st.open.call = mergeCall(st.open.call, r.call);
      stats.linesMerged += 1;
    } else {
      closeCall(st, slug, sessionId);
      st.open = { call: r.call, start: line.start };
    }
  }

  function processFile(/** @type {import("./file-discovery").TranscriptFile} */ f, /** @type {string} */ slug, /** @type {FileState} */ st,
    /** @type {{ bytes: number, calls: number }} */ budget, /** @type {number} */ nowMs) {
    const limit = settled() + budget.calls;
    let drained = st.pos >= f.size;
    st.heldAt = -1;
    while (st.pos < f.size && budget.bytes > 0 && settled() < limit) {
      const windowBytes = Math.min(L.readWindowBytes, Math.max(budget.bytes, 64 * 1024));
      const win = readWindow(f.file, st.pos, f.size, { windowBytes, maxLineBytes: L.maxLineBytes });
      budget.bytes -= win.bytesRead;
      stats.bytesRead += win.bytesRead;
      stats.lastTickBytes += win.bytesRead;
      if (win.oversized) {
        stats.linesOversized += 1;
        st.pos = win.next;
        continue;
      }
      if (!win.lines.length) { // partial last line held until it completes
        drained = true;
        st.heldAt = f.size;
        break;
      }
      for (const line of win.lines) {
        handleLine(line, st, slug, f.sessionId);
        if (settled() >= limit) break;
      }
    }
    budget.calls = Math.max(0, limit - settled());
    if (st.open && (drained || st.pos >= f.size) && nowMs - f.mtimeMs >= L.quietMs) closeCall(st, slug, f.sessionId);
    st.size = f.size;
    st.mtimeMs = f.mtimeMs;
    checkpoints.set(slug, f.file, { offset: st.open ? st.open.start : st.pos, size: f.size, mtimeMs: f.mtimeMs, seenAt: nowMs });
  }

  /** One bounded tick. Never throws; errors are counted. */
  function tick() {
    const started = process.hrtime.bigint();
    const nowMs = now();
    stats.lastTickBytes = 0;
    const budget = { bytes: L.maxBytesPerTick, calls: L.maxCallsPerTick };
    let backlog = false;
    try {
      slugByHint.clear();
      const files = discover(root, nowMs, cache).sort((a, b) => b.mtimeMs - a.mtimeMs);
      stats.filesTracked = files.length;
      let unmatched = 0;
      for (const f of files) {
        const slug = attribute(f.hint);
        if (!slug) {
          unmatched += 1;
          continue;
        }
        try {
          const st = stateFor(f, slug, nowMs);
          const quiet = st.open !== null && nowMs - f.mtimeMs >= L.quietMs;
          if ((st.pos >= f.size || st.heldAt === f.size) && !quiet) continue;
          if (budget.bytes <= 0 || budget.calls <= 0) {
            backlog = true;
            continue;
          }
          processFile(f, slug, st, budget, nowMs);
          if (st.pos < f.size && (budget.bytes <= 0 || budget.calls <= 0)) backlog = true;
        } catch {
          stats.errors += 1;
        }
      }
      stats.filesUnmatched = unmatched;
      checkpoints.flush(nowMs);
    } catch {
      stats.errors += 1;
    }
    stats.backlog = backlog;
    stats.ticks += 1;
    stats.lastTickAt = new Date(nowMs).toISOString();
    stats.lastTickMs = Number(process.hrtime.bigint() - started) / 1e6;
    return { backlog };
  }

  return {
    tick,
    getStats: () => ({ ...stats, openCalls: [...states.values()].filter((s) => s.open).length }),
    recordError: () => { stats.errors += 1; },
  };
}

module.exports = { createUsageIngestor };

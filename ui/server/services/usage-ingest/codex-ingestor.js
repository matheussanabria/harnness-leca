// @ts-check
// Bounded, incremental ingest of Codex CLI rollout files into usage.observed events (plan T3.4).
//
// Mirrors usage-ingestor.js with two differences: a token_count event is one complete call (no streaming
// merge, so the checkpoint offset simply follows the last consumed line), and the project comes from the
// thread's cwd in state_5.sqlite (same read-only code as the presence scanner), not from the folder name.
// Per file the checkpoint also keeps the latest model id and the key of the last total, so an incremental
// read resumes with the right model. Subagent threads (thread_spawn_edges, or source "subagent" on the
// first session_meta) are excluded as a whole: their file replays the parent history.
const os = require("os");
const path = require("path");
const { ingestEvent } = require("../events/event-ingest");
const cfg = require("./codex-config");
const { discoverRollouts } = require("./codex-file-discovery");
const { readWindow } = require("./transcript-reader");
const { createCheckpointStore } = require("./checkpoint-store");
const { extractRecord, toEventBody } = require("./codex-call-normalizer");
const { extractQuota } = require("./codex-quota-normalizer");
const { getQuotaStore } = require("./quota-store");
const { costOf } = require("./usage-cost");
const { lookupCodexThreads } = require("../external-presence/presence-sources-db");

/** @typedef {{ pos: number, size: number, mtimeMs: number, model: string | null, lastKey: string | null, skip: boolean, metaChecked: boolean }} FileState */

function defaultCoordinationDir() {
  const { ROOT } = require("../../../../tools/lib/root");
  return (/** @type {string} */ slug) => path.join(ROOT, "projects", slug, "coordination");
}

/**
 * @param {{ codexHome?: string, resolveProject?: (cwd: string) => string | null, publish?: (slug: string, body: any) => { duplicated: boolean },
 *   estimator?: ((input: any) => any) | null, now?: () => number, host?: string, coordinationDir?: (slug: string) => string,
 *   limits?: Partial<typeof cfg.LIMITS>, quotaStore?: { save: (s: unknown) => boolean } }} [options]
 */
function createCodexIngestor(options = {}) {
  const L = { ...cfg.LIMITS, ...options.limits };
  const home = options.codexHome || cfg.defaultHome();
  const now = options.now || Date.now;
  const publish = options.publish || ingestEvent;
  const host = options.host || os.hostname();
  const checkpoints = createCheckpointStore(options.coordinationDir || defaultCoordinationDir(), L.checkpointTtlMs, cfg.CHECKPOINT_FILE);
  let resolveProject = options.resolveProject || null;
  /** Latest rate-limit snapshot seen in this tick (quotas are global, not per project). */
  /** @type {import("./quota-model").QuotaSnapshot | null} */
  let latestQuota = null;
  /** @type {Map<string, FileState>} */
  const states = new Map();
  /** @type {Map<string, { cwd: string, child: boolean }>} */
  const threads = new Map();
  /** @type {Set<string>} thread ids looked up in state_5.sqlite without a row */
  const absent = new Set();
  const cache = {
    cold: new Map(), coldAfterMs: L.coldAfterMs, coldSweepMs: L.coldSweepMs,
    isSettled: (/** @type {string} */ file, /** @type {number} */ size, /** @type {string} */ id) => {
      const st = states.get(file);
      if (st) return st.skip || st.pos >= size;
      const t = threads.get(id);
      // Not looked up yet is NOT settled; only a looked-up miss, a subagent or an unmatched cwd is.
      return t ? t.child || attribute(t.cwd) === null : absent.has(id);
    },
  };
  const stats = {
    ticks: 0, callsPublished: 0, duplicates: 0, eventsSkipped: 0, repeatedTotals: 0, linesRead: 0, linesUnparsable: 0,
    linesOversized: 0, filesTracked: 0, filesUnmatched: 0, filesSubagent: 0, resets: 0, bytesRead: 0, lastTickBytes: 0,
    lastTickMs: 0, lastTickAt: /** @type {string | null} */ (null), backlog: false, failed: 0, errors: 0,
  };
  const settled = () => stats.callsPublished + stats.duplicates + stats.failed;

  /** @param {string} cwd @returns {string | null} */
  function attribute(cwd) {
    if (!cwd) return null;
    if (!resolveProject) resolveProject = require("../external-presence/presence-scanner").createDefaultResolver();
    return /** @type {Function} */ (resolveProject)(cwd) || null;
  }

  /** @returns {FileState} */
  function stateFor(/** @type {import("./codex-file-discovery").RolloutFile} */ f, /** @type {string} */ slug, /** @type {number} */ nowMs) {
    let st = states.get(f.file);
    if (!st) {
      const cp = checkpoints.get(slug, f.file);
      const base = { model: null, lastKey: null, skip: false };
      if (cp) st = { ...base, pos: cp.offset, size: cp.size, mtimeMs: cp.mtimeMs, model: cp.model ?? null, lastKey: cp.lastKey ?? null, skip: cp.skip === true, metaChecked: true };
      // First backfill: files older than the window are not read; only bytes appended later count.
      else if (nowMs - f.mtimeMs >= L.backfillDays * 86400000) st = { ...base, pos: f.size, size: f.size, mtimeMs: f.mtimeMs, metaChecked: true };
      else st = { ...base, pos: 0, size: 0, mtimeMs: 0, metaChecked: false };
      states.set(f.file, st);
    }
    if (f.size < st.size || f.size < st.pos || (st.size > 0 && f.mtimeMs < st.mtimeMs)) { // truncated or replaced
      stats.resets += 1;
      Object.assign(st, { pos: 0, model: null, lastKey: null, skip: false, metaChecked: false });
    }
    return st;
  }

  function handleLine(/** @type {{ text: string, end: number }} */ line, /** @type {FileState} */ st, /** @type {string} */ slug, /** @type {string} */ threadId) {
    stats.linesRead += 1;
    st.pos = line.end;
    const q = extractQuota(line.text);
    if (q && (!latestQuota || Date.parse(q.observedAt) >= Date.parse(latestQuota.observedAt))) latestQuota = q;
    const r = extractRecord(line.text);
    if (r.status === "unparsable") stats.linesUnparsable += 1;
    else if (r.status === "model") st.model = r.model || st.model;
    else if (r.status === "meta") {
      if (!st.metaChecked && r.subagent) st.skip = true;
      st.metaChecked = true;
    } else if (r.status === "skip") stats.eventsSkipped += 1;
    else if (r.status === "call") {
      if (r.call.key === st.lastKey) { stats.repeatedTotals += 1; return; }
      st.lastKey = r.call.key;
      const cost = costOf({ provider: cfg.PROVIDER, model: st.model, tokens: r.call.tokens, at: r.call.at }, options.estimator);
      try {
        const res = publish(slug, toEventBody(r.call, { threadId, slug, host, model: st.model, cost }));
        if (res.duplicated) stats.duplicates += 1;
        else stats.callsPublished += 1;
      } catch {
        stats.failed += 1; // dropped for this run; a poison call must not block the file forever
      }
    }
  }

  function processFile(/** @type {import("./codex-file-discovery").RolloutFile} */ f, /** @type {string} */ slug, /** @type {FileState} */ st,
    /** @type {{ bytes: number, calls: number }} */ budget, /** @type {number} */ nowMs) {
    const limit = settled() + budget.calls;
    while (st.pos < f.size && !st.skip && budget.bytes > 0 && settled() < limit) {
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
      if (!win.lines.length) break; // partial last line held until it completes
      for (const line of win.lines) {
        handleLine(line, st, slug, f.threadId);
        if (st.skip) break;
        if (settled() >= limit) break;
      }
    }
    budget.calls = Math.max(0, limit - settled());
    st.size = f.size;
    st.mtimeMs = f.mtimeMs;
    // A skipped (subagent) file is marked consumed so it is never read again.
    checkpoints.set(slug, f.file, {
      offset: st.skip ? f.size : st.pos, size: f.size, mtimeMs: f.mtimeMs, seenAt: nowMs,
      model: st.model, lastKey: st.lastKey, skip: st.skip,
    });
  }

  /** One bounded tick. Never throws; errors are counted. */
  function tick() {
    const started = process.hrtime.bigint();
    const nowMs = now();
    stats.lastTickBytes = 0;
    const budget = { bytes: L.maxBytesPerTick, calls: L.maxCallsPerTick };
    let backlog = false;
    latestQuota = null;
    try {
      const files = discoverRollouts(home, nowMs, cache).sort((a, b) => b.mtimeMs - a.mtimeMs);
      stats.filesTracked = files.length;
      const unknown = files.filter((f) => !threads.has(f.threadId) && !(states.get(f.file)?.pos === f.size)).map((f) => f.threadId);
      if (unknown.length) {
        const ids = [...new Set(unknown)];
        const found = lookupCodexThreads(home, ids);
        for (const id of ids) {
          const t = found.get(id);
          if (t) { threads.set(id, t); absent.delete(id); } else absent.add(id);
        }
      }
      let unmatched = 0;
      for (const f of files) {
        const t = threads.get(f.threadId);
        const slug = t && !t.child ? attribute(t.cwd) : null;
        if (!slug) {
          if (!t || !t.child) unmatched += 1;
          continue;
        }
        try {
          const st = stateFor(f, slug, nowMs);
          if (st.skip || st.pos >= f.size) continue;
          if (budget.bytes <= 0 || budget.calls <= 0) {
            backlog = true;
            continue;
          }
          processFile(f, slug, st, budget, nowMs);
          if (st.pos < f.size && !st.skip && (budget.bytes <= 0 || budget.calls <= 0)) backlog = true;
        } catch {
          stats.errors += 1;
        }
      }
      stats.filesUnmatched = unmatched;
      stats.filesSubagent = files.filter((f) => threads.get(f.threadId)?.child || states.get(f.file)?.skip).length;
      checkpoints.flush(nowMs);
      if (latestQuota) (options.quotaStore || getQuotaStore()).save(latestQuota);
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
    getStats: () => ({ ...stats }),
    recordError: () => { stats.errors += 1; },
  };
}

module.exports = { createCodexIngestor };

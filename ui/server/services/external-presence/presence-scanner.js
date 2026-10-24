// @ts-check
// Scanner de presenca externa (T2.4): varre as fontes, infere atividade/presenca e publica
// session.discovered / session.updated no event log SO quando algo muda (design 06).
//
// Estado em memoria: ultimo estado publicado por sessao. Reiniciar o servidor perde esse estado,
// mas a chave de idempotencia (estado + balde do sinal) faz o replay ser no-op no store.
const os = require("os");
const { ingestEvent } = require("../events/event-ingest");
const cfg = require("./presence-config");
const { inferPresence, bucketOf, idempotencyKeyOf } = require("./presence-inference");
const files = require("./presence-sources-files");
const dbs = require("./presence-sources-db");

/** Resolve o slug do projeto a partir do hint de cwd, reaproveitando o mapeamento do repositorio. */
function createDefaultResolver() {
  const projects = require("../../../../tools/lib/projects");
  let cache = null;
  let loadedAt = 0;
  return (/** @type {string} */ hint) => {
    const now = Date.now();
    if (!cache || now - loadedAt > cfg.MATCHER_TTL_MS) {
      cache = projects.matchers();
      loadedAt = now;
    }
    return projects.projectFromPath(hint, cache);
  };
}

/**
 * @param {{ roots?: import("./presence-config").PresenceRoots, resolveProject?: (hint: string) => string | null,
 *   now?: () => number, publish?: (slug: string, body: any) => { duplicated: boolean },
 *   readers?: Record<string, (roots: any, now: number) => any[]>, host?: string }} [options]
 */
function createPresenceScanner(options = {}) {
  const roots = options.roots || cfg.defaultRoots();
  const now = options.now || Date.now;
  const publish = options.publish || ingestEvent;
  const host = options.host || os.hostname();
  let resolveProject = options.resolveProject || null;
  const coldClaude = files.createColdCache();
  const coldAntigravity = files.createColdCache();
  const readers = options.readers || {
    claude: (r, t) => files.readClaude(r.claudeProjects, t, coldClaude),
    codex: (r, t) => dbs.readCodex(r.codexHome, t),
    antigravity: (r, t) => dbs.attachAntigravityWorkspaces(files.readAntigravity(r.antigravityBrains, t, coldAntigravity), r.antigravitySummaryDbs),
    opencode: (r, t) => dbs.readOpenCode(r.opencodeDb, t),
  };

  /** @type {Map<string, { activity: string, presence: string, bucket: number }>} */
  const last = new Map();
  const stats = {
    scans: 0, lastScanMs: 0, lastScanAt: null, candidates: 0, published: 0, duplicated: 0,
    unmatched: 0, failed: 0, errors: 0, byEngine: {}, sourceErrors: {},
  };

  function collect(nowMs) {
    const all = [];
    for (const [name, read] of Object.entries(readers)) {
      try {
        all.push(...read(roots, nowMs));
      } catch {
        stats.errors += 1;
        stats.sourceErrors[name] = (stats.sourceErrors[name] || 0) + 1;
      }
    }
    return { candidates: all };
  }

  function emit(slug, c, state, nowMs, type) {
    const sessionId = `${c.engine}:${c.nativeId}`;
    const seen = new Date(nowMs).toISOString();
    const result = publish(slug, {
      type,
      at: seen,
      source: { provider: c.engine, kind: cfg.SOURCE_KIND },
      trust: "inferred",
      relation: "inferred",
      projectId: slug,
      sessionId,
      nativeSessionId: c.nativeId,
      engineInstanceId: `${c.engine}@${host}`.slice(0, 200),
      idempotencyKey: idempotencyKeyOf(c.engine, sessionId, state, c.signalMs),
      payload: {
        origin: "external", engine: c.engine, provider: c.engine,
        activity: state.activity, presence: state.presence,
        lastActivityAt: new Date(c.signalMs).toISOString(), lastSeenAt: seen, signal: cfg.SIGNAL,
      },
    });
    if (result.duplicated) stats.duplicated += 1;
    else stats.published += 1;
  }

  /** Uma varredura sincrona. Erros de fonte e de publicacao sao contados, nunca propagados. */
  function scanOnce() {
    const started = process.hrtime.bigint();
    const nowMs = now();
    if (!resolveProject) resolveProject = createDefaultResolver();
    const { candidates } = collect(nowMs);
    const alive = new Set();
    const hints = new Map();
    let unmatched = 0;
    stats.candidates = candidates.length;
    for (const c of candidates) {
      const state = inferPresence(c.signalMs, nowMs);
      if (!state) continue;
      let slug;
      try {
        if (!hints.has(c.hint)) hints.set(c.hint, c.hint ? resolveProject(c.hint) : null);
        slug = hints.get(c.hint);
      } catch {
        stats.errors += 1;
        continue;
      }
      if (!slug) {
        unmatched += 1;
        continue;
      }
      const key = `${c.engine}:${c.nativeId}`;
      alive.add(key);
      const prev = last.get(key);
      const bucket = bucketOf(c.signalMs);
      const changed = !prev || prev.activity !== state.activity || prev.presence !== state.presence
        || (state.activity === "processing" && prev.bucket !== bucket);
      if (!changed) continue;
      try {
        emit(slug, c, state, nowMs, prev ? "session.updated" : "session.discovered");
        last.set(key, { ...state, bucket });
        stats.byEngine[c.engine] = (stats.byEngine[c.engine] || 0) + (prev ? 0 : 1);
      } catch {
        stats.failed += 1;
      }
    }
    for (const key of last.keys()) if (!alive.has(key)) last.delete(key);
    stats.unmatched = unmatched; // sessoes recentes de projeto desconhecido na ultima varredura
    stats.scans += 1;
    stats.lastScanAt = new Date(nowMs).toISOString();
    stats.lastScanMs = Number(process.hrtime.bigint() - started) / 1e6;
  }

  return { scanOnce, getStats: () => ({ ...stats, tracked: last.size }), recordError: () => { stats.errors += 1; } };
}

module.exports = { createPresenceScanner };

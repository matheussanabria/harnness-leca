// @ts-check
// Merges the EP-09 session projection into the Central read model (story T2.5).
// Pure functions. Match order mirrors the reconciler: exact id, native id inside the registry
// fingerprint (provider|nativeId|source), then no link. A link is never invented: an unmatched
// projection session becomes its own row and stays unlinked.

const { EXECUTION_STATUS, WORKFLOW_STATUS, ATTENTION_STATUS } = require("./session-model");

const MATCH_EXACT = "exact";
const MATCH_NATIVE = "native";
const MATCH_NONE = "none";

const norm = (value) => String(value || "").trim().toLowerCase();
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Registry ids are fingerprints `provider|nativeId|source`; other ids carry no native id. */
function fingerprintParts(id) {
  const parts = String(id || "").split("|");
  return parts.length === 3 ? { provider: norm(parts[0]), native: norm(parts[1]) } : null;
}

/** Native id of a projection view: the explicit field, else the suffix of `engine:native`. */
function nativeOf(view) {
  if (view.nativeSessionId) return norm(view.nativeSessionId);
  const text = String(view.sessionId || "");
  return text.includes(":") ? norm(text.slice(text.indexOf(":") + 1)) : "";
}

/**
 * Which registry session (if any) a projection view refers to.
 * @param {any} view
 * @param {Map<string, any>} byId
 * @param {Map<string, any>} byNative key `native` or `provider|native`
 * @returns {{ rule: string, session: any }}
 */
function matchProjection(view, byId, byNative) {
  const exact = byId.get(String(view.sessionId));
  if (exact) return { rule: MATCH_EXACT, session: exact };
  const native = nativeOf(view);
  if (native) {
    const provider = norm(view.provider);
    const hit = provider ? byNative.get(`${provider}|${native}`) : null;
    if (hit) return { rule: MATCH_NATIVE, session: hit };
  }
  return { rule: MATCH_NONE, session: null };
}

/** Presence fields copied onto a registry session or a new row (additive). */
function presenceOf(view) {
  return {
    origin: view.origin || null,
    activity: view.activity || null,
    presence: view.presence || null,
    lastActivityAt: view.lastActivityAt || null,
    lastSeenAt: view.lastSeenAt || null,
    nativeSessionId: view.nativeSessionId || null,
  };
}

/** Projection-only row. External sessions are scanner-inferred; unknown origin stays unknown. */
function rowFromView(view, projectId) {
  const native = nativeOf(view);
  const engine = view.provider || "";
  const chat = view.origin === "harness_chat";
  const label = chat ? "Chat do Harness" : engine || "Sessão";
  const short = (view.nativeSessionId || native || String(view.sessionId)).slice(0, 8);
  const confidence = view.origin === "external" ? "inferred" : chat ? "observed" : "unknown";
  const seen = view.lastActivityAt || view.lastSeenAt || view.lastEventAt || "";
  return {
    id: String(view.sessionId),
    schemaVersion: 1,
    projectId: projectId || view.projectId || null,
    projectConfidence: confidence,
    title: `${label} ${short}`.trim(),
    titleSource: "derived",
    primaryProvider: engine,
    executionStatus: oneOf(view.executionStatus, EXECUTION_STATUS, "unknown"),
    workflowStatus: oneOf(view.workflowStatus, WORKFLOW_STATUS, "none"),
    attentionStatus: oneOf(view.attentionStatus, ATTENTION_STATUS, "none"),
    createdAt: seen,
    lastObservedAt: seen,
    archivedAt: null,
    source: "projection",
    ...presenceOf(view),
  };
}

/**
 * @param {any[]} registrySessions canonical (Markdown/discovery) sessions
 * @param {any[]} views projection session views
 * @param {{ projectId?: string }} [options]
 * @returns {any[]} merged list: every registry session (enriched when matched) plus unmatched views
 */
function mergeProjection(registrySessions, views, options = {}) {
  const byId = new Map();
  const byNative = new Map();
  for (const session of registrySessions) {
    byId.set(String(session.id), session);
    const parts = fingerprintParts(session.id);
    if (parts && parts.native) byNative.set(`${parts.provider}|${parts.native}`, session);
  }
  const enriched = new Map();
  const extra = new Map();
  for (const view of views || []) {
    if (!view || !view.sessionId) continue;
    const { session } = matchProjection(view, byId, byNative);
    if (session) {
      const prev = enriched.get(session.id) || { ...session, source: "registry" };
      const merged = { ...prev, ...Object.fromEntries(Object.entries(presenceOf(view)).filter(([, v]) => v)), source: "merged" };
      enriched.set(session.id, merged);
      continue;
    }
    extra.set(String(view.sessionId), rowFromView(view, options.projectId));
  }
  const base = registrySessions.map((session) => enriched.get(session.id) || session);
  const added = [...extra.values()].sort((a, b) => String(b.lastObservedAt).localeCompare(String(a.lastObservedAt)) || a.id.localeCompare(b.id));
  return [...base, ...added];
}

module.exports = { MATCH_EXACT, MATCH_NATIVE, MATCH_NONE, mergeProjection, matchProjection, rowFromView };

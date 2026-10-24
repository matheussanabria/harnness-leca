// @ts-check
// Turns one transcript line into a minimal call record, merges streaming duplicates, builds the
// usage.observed body. PRIVACY (ADR-TEL-007, user-approved scope): a line is parsed, an allow-list of
// scalar fields is copied and everything else (message text, tool input/output, cwd, prompts) is dropped
// on the spot. Nothing outside the allow-list ever leaves extractCall.
const { SOURCE_PROVIDER, SOURCE_KIND, ENGINE, PROVIDER } = require("./usage-config");

const TOKEN_FIELDS = /** @type {const} */ ([
  ["input", "input_tokens"],
  ["output", "output_tokens"],
  ["cacheRead", "cache_read_input_tokens"],
  ["cacheCreation", "cache_creation_input_tokens"],
]);
const ID_MAX = 200;

/** @param {unknown} v @returns {number | null} numeric 0 stays 0; anything non-numeric is null */
function num(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** @param {unknown} v @returns {string | null} */
function str(v) {
  return typeof v === "string" && v ? v.slice(0, ID_MAX) : null;
}

/**
 * Cheap pre-filter on the raw text so non-assistant lines (the bulk of a transcript) are never parsed.
 * @param {string} line
 * @returns {boolean}
 */
function mightCarryUsage(line) {
  return line.includes('"usage"') && line.includes('"assistant"');
}

/**
 * @typedef {Object} CallRecord
 * @property {string} callId
 * @property {string | null} model
 * @property {string} at
 * @property {boolean} sidechain
 * @property {string | null} agentId
 * @property {{ input: number | null, output: number | null, cacheRead: number | null, cacheCreation: number | null, reasoning: null }} tokens
 */

/**
 * @param {string} line raw JSONL line
 * @returns {{ status: "call", call: CallRecord } | { status: "skip" } | { status: "unparsable" }}
 */
function extractCall(line) {
  /** @type {any} */
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return { status: "unparsable" };
  }
  const msg = obj && obj.type === "assistant" ? obj.message : null;
  const usage = msg && typeof msg === "object" ? msg.usage : null;
  const callId = msg ? str(msg.id) : null;
  if (!usage || typeof usage !== "object" || !callId) return { status: "skip" };
  const model = str(msg.model);
  if (model === "<synthetic>") return { status: "skip" };
  const at = typeof obj.timestamp === "string" ? obj.timestamp : "";
  if (!at || Number.isNaN(Date.parse(at))) return { status: "unparsable" };
  const tokens = { input: num(usage.input_tokens), output: num(usage.output_tokens), cacheRead: num(usage.cache_read_input_tokens), cacheCreation: num(usage.cache_creation_input_tokens), reasoning: /** @type {null} */ (null) };
  const sidechain = obj.isSidechain === true;
  return { status: "call", call: { callId, model, at, sidechain, agentId: sidechain ? str(obj.agentId) : null, tokens } };
}

/**
 * Streaming duplicates of one call: keep the FINAL usage. Token counts are cumulative and
 * non-decreasing, so the per-field maximum equals the last line; a field stays null unless some line
 * carried a number.
 * @param {CallRecord} acc
 * @param {CallRecord} next
 * @returns {CallRecord}
 */
function mergeCall(acc, next) {
  const tokens = { ...acc.tokens };
  for (const [key] of TOKEN_FIELDS) {
    const a = acc.tokens[key];
    const b = next.tokens[key];
    tokens[key] = a === null ? b : b === null ? a : Math.max(a, b);
  }
  return { ...acc, model: next.model || acc.model, tokens, sidechain: acc.sidechain || next.sidechain, agentId: acc.agentId || next.agentId };
}

/**
 * @param {CallRecord} call
 * @param {{ nativeSessionId: string, slug: string, host: string, cost: Record<string, any> | null }} ctx
 * @returns {Record<string, any>} body for ingestEvent
 */
function toEventBody(call, ctx) {
  return {
    type: "usage.observed",
    at: call.at,
    source: { provider: SOURCE_PROVIDER, kind: SOURCE_KIND },
    trust: "inferred",
    relation: "inferred",
    projectId: ctx.slug,
    sessionId: `${ENGINE}:${ctx.nativeSessionId}`,
    nativeSessionId: ctx.nativeSessionId,
    engineInstanceId: `${ENGINE}@${ctx.host}`.slice(0, ID_MAX),
    agentId: call.agentId,
    idempotencyKey: `usage|${ENGINE}|${call.callId}`.slice(0, ID_MAX),
    payload: {
      callId: call.callId,
      provider: PROVIDER,
      model: call.model,
      tokens: call.tokens,
      cost: ctx.cost,
      semantics: "final",
      quality: "transcript",
      engine: ENGINE,
      sidechain: call.sidechain,
    },
  };
}

module.exports = { extractCall, mergeCall, toEventBody, mightCarryUsage, TOKEN_FIELDS };

// @ts-check
// Turns one rollout line into a minimal record and builds the usage.observed body. PRIVACY (ADR-TEL-007,
// user-approved scope): a line is parsed, an allow-list of scalars (model id, token numbers, timestamp,
// the subagent flag) is copied and everything else (messages, tool input/output, prompts, instructions, cwd)
// is dropped on the spot. Nothing outside the allow-list leaves this module.
const { SOURCE_PROVIDER, SOURCE_KIND, ENGINE, PROVIDER } = require("./codex-config");

const ID_MAX = 200;

/** @param {unknown} v @returns {number | null} numeric 0 stays 0; anything non-numeric is null */
function num(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** @param {unknown} v @returns {string | null} */
function str(v) {
  return typeof v === "string" && v ? v.slice(0, ID_MAX) : null;
}

/** @param {string} line @returns {"usage" | "model" | "meta" | null} cheap pre-filter on the raw text */
function classify(line) {
  if (line.includes('"token_count"')) return "usage";
  if (line.includes('"turn_context"')) return "model";
  if (line.includes('"session_meta"')) return "meta";
  return null;
}

/**
 * @typedef {Object} CodexCall
 * @property {string} key       thread-independent part of the call id (also the identity of the running total)
 * @property {string} at
 * @property {{ input: number | null, output: number | null, cacheRead: number | null, cacheCreation: number | null, reasoning: number | null }} tokens
 */

/**
 * @param {string} line raw JSONL line
 * @returns {{ status: "call", call: CodexCall } | { status: "model", model: string | null } | { status: "meta", subagent: boolean }
 *   | { status: "skip" } | { status: "unparsable" }}
 */
function extractRecord(line) {
  if (!classify(line)) return { status: "skip" };
  /** @type {any} */
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return { status: "unparsable" };
  }
  const payload = obj && typeof obj === "object" ? obj.payload : null;
  if (!payload || typeof payload !== "object") return { status: "skip" };
  if (obj.type === "turn_context") return { status: "model", model: str(payload.model) };
  if (obj.type === "session_meta") {
    const src = payload.source;
    return { status: "meta", subagent: src === "subagent" || Boolean(src && typeof src === "object" && "subagent" in src) };
  }
  if (obj.type !== "event_msg" || payload.type !== "token_count") return { status: "skip" };
  const info = payload.info;
  const last = info && typeof info === "object" ? info.last_token_usage : null;
  if (!last || typeof last !== "object") return { status: "skip" }; // rate-limit-only update
  const at = typeof obj.timestamp === "string" ? obj.timestamp : "";
  if (!at || Number.isNaN(Date.parse(at))) return { status: "unparsable" };
  const total = info.total_token_usage && typeof info.total_token_usage === "object" ? info.total_token_usage : null;
  const lastSum = num(last.total_tokens);
  // Identity from the running total; without it the id falls back to timestamp + the call's own numbers.
  const key = total && num(total.total_tokens) !== null
    ? `${num(total.total_tokens)}.${num(total.output_tokens)}.${lastSum}`
    : `t${Date.parse(at)}.${lastSum}.${num(last.input_tokens)}.${num(last.output_tokens)}`;
  const tokens = {
    input: num(last.input_tokens), output: num(last.output_tokens), cacheRead: num(last.cached_input_tokens),
    cacheCreation: num(last.cache_write_input_tokens), reasoning: num(last.reasoning_output_tokens),
  };
  return { status: "call", call: { key, at, tokens } };
}

/**
 * @param {CodexCall} call
 * @param {{ threadId: string, slug: string, host: string, model: string | null, cost: Record<string, any> | null }} ctx
 * @returns {Record<string, any>} body for ingestEvent
 */
function toEventBody(call, ctx) {
  const callId = `${ctx.threadId}:${call.key}`.slice(0, ID_MAX);
  return {
    type: "usage.observed",
    at: call.at,
    source: { provider: SOURCE_PROVIDER, kind: SOURCE_KIND },
    trust: "inferred",
    relation: "inferred",
    projectId: ctx.slug,
    sessionId: `${ENGINE}:${ctx.threadId}`,
    nativeSessionId: ctx.threadId,
    engineInstanceId: `${ENGINE}@${ctx.host}`.slice(0, ID_MAX),
    agentId: null,
    idempotencyKey: `usage|${ENGINE}|${callId}`.slice(0, ID_MAX),
    payload: {
      callId,
      provider: PROVIDER,
      model: ctx.model,
      tokens: call.tokens,
      cost: ctx.cost,
      semantics: "final",
      quality: "rollout",
      engine: ENGINE,
      sidechain: false,
    },
  };
}

module.exports = { extractRecord, toEventBody, classify };

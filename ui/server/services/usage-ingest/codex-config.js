// @ts-check
// Constants of the Codex rollout usage ingest (plan T3.4).
//
// REAL ROLLOUT SHAPE (observed read-only on this machine with a throwaway key-path survey: 56 rollouts,
// ~41 MB, 2505 token_count events; key paths and numbers only, no content was read or kept):
//  - Files: <codexHome>/sessions/YYYY/MM/DD/rollout-<ts>-<threadUuid>.jsonl. Line envelope: {timestamp, type, payload}.
//  - Top-level types: session_meta, response_item, event_msg, turn_context, world_state, compacted, ...
//  - session_meta.payload: id (== uuid in the file name), cwd, source, cli_version, model_provider, ... A file may
//    hold several session_meta lines with the SAME id (context-window segments); they are not replays. A subagent
//    file starts with source "subagent" (13 of 56 files) and then REPLAYS the parent history (events whose
//    numbers also exist in the parent file), so subagent files are skipped as a whole.
//  - turn_context.payload.model: the model of the following calls (8 distinct ids seen, always present before
//    the first token_count). It is the only model source; token_count carries none.
//  - event_msg/token_count.payload: info (null on 11 of 2505 events: rate-limit-only update) and rate_limits.
//    info = { total_token_usage, last_token_usage, model_context_window }; both usage objects carry
//    input_tokens, cached_input_tokens (a SUBSET of input_tokens), output_tokens, reasoning_output_tokens
//    (a SUBSET of output_tokens), total_tokens (== input + output) and, on newer builds,
//    cache_write_input_tokens (2119 of 2494).
//  - SEMANTICS: total_token_usage is the running total of the thread. last_token_usage is the usage of ONE
//    model call: it equals total(n) - total(n-1) on 2218 of 2220 consecutive events. The other 2 are context
//    resets where the total drops and last == total. So last_token_usage is the per-call value and needs no
//    subtraction; the delta rule is "take last_token_usage" (semantics 'final').
//  - DUPLICATES: 224 token_count events repeat the previous total exactly (same call re-emitted); they are not
//    new calls and are skipped (and would collapse by idempotency anyway).
//  - CALL IDENTITY: there is no request/response id on token_count. The deterministic id is
//    <threadId>:<total.total_tokens>.<total.output_tokens>.<last.total_tokens>: a running total never repeats
//    inside a thread (barring a reset to the exact same numbers), so replays and re-emits map to one id.
//    Not verified: that every token_count equals exactly one API call (tool loops are assumed to emit one each).
const os = require("os");
const path = require("path");

const SOURCE_PROVIDER = "codex";
const SOURCE_KIND = "rollout";
const ENGINE = "codex";
const PROVIDER = "openai";

const LIMITS = Object.freeze({
  maxBytesPerTick: 2 * 1024 * 1024,
  maxCallsPerTick: 400,
  readWindowBytes: 1024 * 1024,
  maxLineBytes: 16 * 1024 * 1024,
  /** First backfill covers files modified within this many days. */
  backfillDays: 14,
  coldAfterMs: 60 * 60 * 1000,
  coldSweepMs: 5 * 60 * 1000,
  checkpointTtlMs: 30 * 24 * 3600 * 1000,
});

const CHECKPOINT_FILE = "usage-ingest-codex-checkpoints.json";

/** @param {string} [home] @returns {string} */
function defaultHome(home = os.homedir()) {
  return path.join(home, ".codex");
}

module.exports = { SOURCE_PROVIDER, SOURCE_KIND, ENGINE, PROVIDER, LIMITS, CHECKPOINT_FILE, defaultHome };

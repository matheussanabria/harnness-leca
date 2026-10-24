// @ts-check
// Constants and default roots of the Claude Code transcript usage ingest (plan T3.1).
//
// REAL TRANSCRIPT SHAPE (observed read-only on this machine, key paths and counts only; no content):
//  - Files: <root>/<cwd-slug>/<sessionId>.jsonl and <root>/<cwd-slug>/<sessionId>/subagents/agent-*.jsonl.
//  - Assistant lines: type="assistant", timestamp (ISO, always present), isSidechain, cwd, sessionId,
//    requestId (missing on ~0.1% of lines), agentId (sidechain only), message.{id,model,usage,stop_reason,...}.
//  - message.usage keys: input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
//    (always numeric ints), output_tokens_details.thinking_tokens, cache_creation.{ephemeral_5m,1h}_input_tokens,
//    service_tier, speed, iterations[], server_tool_use, inference_geo. No cost on assistant lines.
//  - Streaming: ONE LINE PER CONTENT BLOCK, all sharing the same message.id (and requestId). Duplicates are
//    contiguous inside one file, never interleaved with another id and never spread over files. Across the
//    duplicates input/cache numbers are identical and output_tokens is cumulative and non-decreasing; the
//    LAST line carries the final value (stop_reason is non-null on the last line in ~78% of the calls only).
//  - Sidechain: isSidechain=true lines exist only in subagents/ files, with agentId and the PARENT sessionId.
//  - model values include the pseudo-model "<synthetic>" (zero usage, not a real call): skipped.
const os = require("os");
const path = require("path");

const SOURCE_PROVIDER = "claude";
const SOURCE_KIND = "transcript";
const ENGINE = "claude";
const PROVIDER = "anthropic";

const LIMITS = Object.freeze({
  /** Default tick period; HARNESS_USAGE_INTERVAL_MS overrides (min MIN_INTERVAL_MS). */
  intervalMs: 30 * 1000,
  minIntervalMs: 1000,
  /** Delay between ticks while a backlog remains (chunked backfill). */
  backlogDelayMs: 100,
  /** Per-tick work bounds: bytes read and calls published, whichever comes first. */
  maxBytesPerTick: 1024 * 1024,
  maxCallsPerTick: 200,
  /** Largest single read window, and the largest line accepted (longer lines are skipped). */
  readWindowBytes: 1024 * 1024,
  maxLineBytes: 8 * 1024 * 1024,
  /** First backfill covers files modified within this many days. */
  backfillDays: 14,
  /** An open call is flushed when its file has not grown for this long. */
  quietMs: 60 * 1000,
  /** Files untouched for this long and fully read (or unmatched) are re-statted at most every coldSweepMs. */
  coldAfterMs: 60 * 60 * 1000,
  coldSweepMs: 5 * 60 * 1000,
  /** Checkpoint entries not seen for this long are dropped. */
  checkpointTtlMs: 30 * 24 * 3600 * 1000,
});

/** @param {string} [home] @returns {string} */
function defaultRoot(home = os.homedir()) {
  return path.join(home, ".claude", "projects");
}

module.exports = { SOURCE_PROVIDER, SOURCE_KIND, ENGINE, PROVIDER, LIMITS, defaultRoot };

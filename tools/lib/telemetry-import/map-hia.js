// @ts-check
// Maps a hia-executions.jsonl record to a run.finished event (ADR-TEL-006 decision 5).
// script zeros stay 0 but are flagged unverified; local_llm and unknown executors had tokens
// coerced by the writer (dispatcher hard-codes 0), so their tokens import as null.
// tokensSaved is an estimate: kept apart from tokens, never as measured.
const { legacyKey, numberOrNull, textOrNull, isoOrNull } = require("./common");

const FILE_NAME = "hia-executions.jsonl";

/**
 * @param {Record<string, any>} rec
 * @param {string} line
 * @returns {{ ok: true, input: Record<string, any>, flags: string[] } | { ok: false, reason: string }}
 */
function mapHiaRecord(rec, line) {
  const executionId = textOrNull(rec.executionId);
  if (!executionId) return { ok: false, reason: "missing_executionId" };
  const executorType = textOrNull(rec.executorType);
  const flags = [];
  let input = numberOrNull(rec.tokensPrompt);
  let output = numberOrNull(rec.tokensCompletion);
  let total = numberOrNull(rec.tokensTotal);
  const zeros = [input, output, total].some((n) => n === 0);
  if (zeros && executorType === "script") {
    flags.push("unverified_zero");
  } else if (zeros) {
    // Zero came from writer coercion (not a measured observation): absent, not zero.
    flags.push("coerced_zero");
    input = input === 0 ? null : input;
    output = output === 0 ? null : output;
    total = total === 0 ? null : total;
  }
  const status = textOrNull(rec.status);
  const input_ = {
    type: "run.finished",
    at: isoOrNull(rec.completedAt) || isoOrNull(rec.recordedAt) || undefined,
    source: { provider: "legacy-import", kind: FILE_NAME },
    trust: "inferred",
    relation: "unknown",
    runId: executionId,
    taskId: textOrNull(rec.taskId) || undefined,
    idempotencyKey: legacyKey(FILE_NAME, line),
    payload: {
      origin: "legacy",
      quality: "unknown",
      legacyFile: FILE_NAME,
      status,
      durationMs: numberOrNull(rec.durationMs),
      executor: { type: executorType, id: textOrNull(rec.executorId) },
      tokens: { input, output, total, cacheRead: null, cacheCreation: null, reasoning: null },
      estimates: { tokensSaved: { value: numberOrNull(rec.tokensSaved), method: null, measured: false } },
      flags,
    },
  };
  return { ok: true, input: input_, flags };
}

module.exports = { mapHiaRecord, HIA_FILE: FILE_NAME };

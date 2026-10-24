// @ts-check
// Maps a runtime-shadow.jsonl record to a usage.observed event (ADR-TEL-006 decision 5).
// Failure lines (valid=false) were written with tokens/duration coerced to 0: they import as null.
// Valid lines keep their numbers (a reported zero is a real observation). The load/prompt/eval
// duration fields were 0 on every audited line (never populated), so they are not imported.
const { legacyKey, numberOrNull, textOrNull, isoOrNull } = require("./common");

const FILE_NAME = "runtime-shadow.jsonl";

/**
 * @param {Record<string, any>} rec
 * @param {string} line
 * @returns {{ ok: true, input: Record<string, any>, flags: string[] } | { ok: false, reason: string }}
 */
function mapRuntimeRecord(rec, line) {
  const correlationId = textOrNull(rec.correlationId);
  if (!correlationId) return { ok: false, reason: "missing_correlationId" };
  if (typeof rec.valid !== "boolean") return { ok: false, reason: "missing_valid" };
  const flags = [];
  let input = numberOrNull(rec.tokensPrompt);
  let output = numberOrNull(rec.tokensGenerated);
  let durationMs = numberOrNull(rec.totalDurationMs);
  if (!rec.valid) {
    flags.push("coerced_zero");
    if (input === 0) input = null;
    if (output === 0) output = null;
    if (durationMs === 0) durationMs = null;
  }
  const errors = Array.isArray(rec.errors) ? rec.errors.filter((e) => typeof e === "string").slice(0, 10) : [];
  const event = {
    type: "usage.observed",
    at: isoOrNull(rec.timestamp) || undefined,
    source: { provider: "legacy-import", kind: FILE_NAME },
    trust: "inferred",
    relation: "unknown",
    runId: correlationId,
    idempotencyKey: legacyKey(FILE_NAME, line),
    payload: {
      origin: "legacy",
      quality: "unknown",
      legacyFile: FILE_NAME,
      callId: `legacy:${FILE_NAME}:${correlationId}`,
      provider: "ollama",
      model: textOrNull(rec.model),
      semantics: "final",
      tokens: { input, output, cacheRead: null, cacheCreation: null, reasoning: null },
      cost: null,
      durationMs,
      valid: rec.valid,
      classification: {
        tipo: textOrNull(rec.tipo),
        complexidade: textOrNull(rec.complexidade),
        executorSugerido: textOrNull(rec.executorSugerido),
        modulo: textOrNull(rec.modulo),
      },
      legacySlug: textOrNull(rec.slug),
      errors,
      flags,
    },
  };
  return { ok: true, input: event, flags };
}

module.exports = { mapRuntimeRecord, RUNTIME_FILE: FILE_NAME };

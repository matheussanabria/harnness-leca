// @ts-check
// Routing outcomes of the HIA dispatcher: 9Router keeps no failure data, so fallbacks (script or local model
// handing the turn to the cloud engine) and the success/failure of combo-routed turns are recorded here in the
// HIA telemetry log. Only identifiers, a status and a short error code are stored; never prompts or answers.
const { recordExecution } = require("../../../tools/lib/hia/telemetry");

/** @param {unknown} v @param {number} max @returns {string} */
const clip = (v, max) => String(v ?? "").replace(/[\r\n\t]+/g, " ").slice(0, max);

/** Short, secret-free error code: a code/name when present, never the message text. @param {any} err */
function errorCode(err) {
  const raw = err && (err.code || err.name);
  return clip(typeof raw === "string" || typeof raw === "number" ? raw : "Error", 40);
}

/** @param {Record<string, any>} rec */
function write(rec) {
  try {
    recordExecution({
      executionId: `exec-${Date.now()}`, durationMs: 0, tokensPrompt: 0, tokensCompletion: 0, tokensTotal: 0, tokensSaved: 0,
      ...rec,
    });
  } catch { /* telemetry must never break a chat turn */ }
}

/**
 * A cheaper route failed and the turn continues on the cloud engine.
 * @param {{ from: "script" | "local_llm", target: string, reason: string, slug: string }} p
 */
function recordFallback({ from, target, reason, slug }) {
  write({ executorType: from, executorId: clip(target, 80), status: "fallback", error: clip(reason, 60), project: clip(slug, 80) });
}

/**
 * A turn that ran on a suggested 9Router combo finished.
 * @param {{ combo: string, ok: boolean, durationMs: number, slug: string, error?: unknown }} p
 */
function recordComboOutcome({ combo, ok, durationMs, slug, error }) {
  write({
    executorType: "combo", executorId: clip(combo, 120), appliedCombo: clip(combo, 120),
    status: ok ? "succeeded" : "failed", durationMs: Math.max(0, Math.floor(durationMs)),
    ...(ok ? {} : { error: errorCode(error) }), project: clip(slug, 80),
  });
}

module.exports = { recordFallback, recordComboOutcome, errorCode };

// @ts-check
// One automatic retry for answers the quality gate rejects. Only for empty and fake tool-call answers (a cut-off
// answer would hit the same limit again), only once, and only with a free model: premium is never used automatically.
const { checkAnswer } = require("./quality-gate");

const RETRYABLE = new Set(["empty", "fake_tool_call"]);
const DEFAULT_RETRY_MODEL = "opencode/deepseek-v4.1-flash-free";
// Free-only combo (glm, minimax, lightning, gpt-oss-20b): the old all-free "Harness" combo no longer exists in 9Router.
const FALLBACK_RETRY_MODEL = "9router/harness-loop";
const FREE_RE = /(-free|:free)$/;

/** A retry model must be free: built-in "-free" models, ":free" routes or the free-only harness-loop combo. */
const isFreeRetryModel = (/** @type {string} */ m) => FREE_RE.test(m) || m === FALLBACK_RETRY_MODEL;

/**
 * Picks a free model different from the one that failed, or "" when none qualifies.
 * @param {string} model
 * @param {Record<string, string | undefined>} [env]
 */
function pickRetryModel(model, env = process.env) {
  const preferred = env.HIA_RETRY_MODEL || DEFAULT_RETRY_MODEL;
  const pick = preferred !== model ? preferred : FALLBACK_RETRY_MODEL;
  return pick !== model && isFreeRetryModel(pick) ? pick : "";
}

/**
 * @typedef {{ text: string, finish?: string, sessionId?: string, aborted?: boolean }} Attempt
 * @param {{
 *   model: string,
 *   attempt: () => Promise<Attempt>,
 *   retry: (model: string) => Promise<Attempt>,
 *   notice: (text: string) => void,
 *   env?: Record<string, string | undefined>,
 * }} o
 * @returns {Promise<Attempt & { gate: ReturnType<typeof checkAnswer>, replaced: boolean, retriedWith?: string }>}
 */
async function withQualityRetry({ model, attempt, retry, notice, env = process.env }) {
  const first = await attempt();
  const gate = checkAnswer(first);
  if (first.aborted || gate.ok) return { ...first, gate, replaced: false };

  const retryModel = RETRYABLE.has(gate.code) && env.HIA_QUALITY_RETRY !== "false" ? pickRetryModel(model, env) : "";
  if (!retryModel) {
    notice(`${gate.reason} Model: ${model || "default"}.`);
    return { ...first, gate, replaced: false };
  }

  notice(`${gate.reason} Model: ${model || "default"}. Retrying once with the free model ${retryModel}.`);
  const second = await retry(retryModel);
  const gate2 = checkAnswer(second);
  if (!second.aborted && !gate2.ok) {
    notice(`${gate2.reason} The retry with ${retryModel} also failed. Pick a stronger model manually if needed; premium models are never used automatically.`);
  }
  return { ...second, gate: gate2, replaced: !second.aborted, retriedWith: retryModel };
}

module.exports = { withQualityRetry, pickRetryModel, isFreeRetryModel, RETRYABLE };

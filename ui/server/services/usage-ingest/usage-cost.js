// @ts-check
// Guarded access to the pricing module (written in parallel, T3.3). A missing module yields cost null.
// Contract: estimateCost({ provider, model, tokens, at }) -> { amount, currency, kind, basis, priceTableVersion, missing } | null.

/** @type {((input: any) => any) | null | undefined} */
let loaded;

/** @returns {((input: any) => any) | null} */
function loadDefaultEstimator() {
  if (loaded !== undefined) return loaded;
  try {
    const mod = require("../../../../tools/lib/pricing");
    loaded = typeof mod.estimateCost === "function" ? mod.estimateCost : null;
  } catch (err) {
    if (!err || /** @type {any} */ (err).code !== "MODULE_NOT_FOUND") throw err;
    loaded = null;
  }
  return loaded;
}

/**
 * Cost of one call, or null when unknown. Estimator failures never break the ingest.
 * @param {{ provider: string, model: string | null, tokens: any, at: string }} call
 * @param {((input: any) => any) | null} [estimator] injected in tests; defaults to the pricing module
 * @returns {Record<string, any> | null}
 */
function costOf(call, estimator) {
  const fn = estimator === undefined ? loadDefaultEstimator() : estimator;
  if (!fn || !call.model) return null;
  try {
    const cost = fn(call);
    return cost && typeof cost === "object" && cost.amount !== null && cost.amount !== undefined ? cost : null;
  } catch {
    return null;
  }
}

module.exports = { costOf };

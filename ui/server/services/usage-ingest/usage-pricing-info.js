// @ts-check
// Price table metadata for the usage summary. All fields are null when the pricing module is unavailable.
const NONE = { version: null, reviewStatus: null, basis: "api-equivalent", retrievedAt: null };

/** @returns {{ version: string | null, reviewStatus: string | null, basis: "api-equivalent", retrievedAt: string | null }} */
function getPriceTableInfo() {
  try {
    const pricing = require("../../../../tools/lib/pricing");
    return typeof pricing.getPriceTableInfo === "function"
      ? { ...NONE, ...pricing.getPriceTableInfo(), basis: "api-equivalent" }
      : { ...NONE };
  } catch {
    return { ...NONE };
  }
}

module.exports = { getPriceTableInfo };

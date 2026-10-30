---
domain: telemetry
module: usage
feature: pricing
summary: Versioned price table, API-equivalent cost estimator and pricing CLI.
paths: [tools/lib/pricing/*.js, tools/lib/pricing/prices.json, tools/pricing.js, tests/pricing*.test.js]
keywords: [pricing, cost, estimateCost, tokens, prices, cache]
updated: 2026-10-30
---
# Pricing

| File | Responsibility |
|---|---|
| `docs/harness-telemetria/diagnostico/A6-antigravity-capability-matrix.md` | Capability matrix for the Antigravity CLI (agy) and IDE: stream-json usage, hooks, resume, local data, unknowns. |
| `tools/lib/pricing/prices.json` | Versioned price table per million tokens, each model with sourceUrl and retrievedAt; `reviewStatus: pending-user-review`. |
| `tools/lib/pricing/index.js` | `estimateCost`: API-equivalent cost from token counts; null when model or counts are unknown, never 0. |
| `tools/lib/pricing/loader.js` | Loads and validates `prices.json` (rejects entries without source), memoised. |
| `tools/pricing.js` | CLI to list the price table and estimate a cost from token counts. |
| `tests/pricing.test.js` | Estimator tests: arithmetic, null handling, model id normalisation, cache rates, table validation. |
| `tests/pricing-cache-split.test.js` | Estimator tests: cache-write TTL split arithmetic, fallbacks, missing flags, table without 1h rate. |

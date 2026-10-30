---
domain: intelligence
module: runtime
feature: quality-gates
summary: Types baseline, regression suite, master index verifier and coordination story owners (EP-11.05).
paths: [tools/types-baseline.js, tools/lib/tsc-runner.js, quality/types-baseline.json, scripts/regressao.js, tools/verify-index.js, tests/verify-index.test.js, tools/lib/coordination/config.js]
keywords: [types-baseline, regression, verify-index, tsc, coordination, story-owners, ep-11]
updated: 2026-10-30
---
# Quality Gates

| File | Responsibility |
|---|---|
| `tools/lib/tsc-runner.js` | TypeScript runner (cached install) shared by `npm run types` and the baseline. |
| `quality/types-baseline.json` | Versioned baseline of the type debt, with the measurement date. |
| `tools/verify-index.js` | Master index verifier: links, per-epic counts (table vs checklist) and declared totals against the real sum. |
| `tests/verify-index.test.js` | Tests of the index verifier, including consistency of the repository's real index. |
| `tools/lib/coordination/config.js` | Ledger providers and `STORY_OWNERS`: owner per story, so the front replaces the engine name. |

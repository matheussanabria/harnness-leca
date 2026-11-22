---
domain: tools
module: exec-log
feature: exec-log
summary: Executive log (decisions, corrections, approvals, open items) read by the executive report.
paths: [tools/exec-log.js, tools/lib/exec-log/*.js, tests/exec-log.test.js, tests/exec-log-report.test.js, docs/executive/README.md, docs/executive/log.jsonl]
keywords: [executive, report, log, journal, evidence, decisions, corrections, pending, metrics, dossiers]
updated: 2026-11-22
---
# Executive log

How and when to write entries, and how to produce a report: `docs/executive/README.md`. The log is append-only JSON lines in Portuguese; each entry points to proof (a file or a commit), and `verify` fails when the proof is missing.

| File | Responsibility |
|---|---|
| `tools/exec-log.js` | CLI: `add`, `list`, `verify`, and `report`, which calls `tools/exec-report.js` (one report generator, see `docs/mapa/tools/reporting/exec-report.md`). |
| `tools/lib/exec-log/store.js` | Entry kinds and limits, validation (reports every problem, refuses secrets and personal data), idempotent append by `key`, open items (pending and risks not resolved), evidence and duplicate-id checks. |
| `tools/lib/exec-log/dossiers.js` | Reads the feature dossiers of the delivered stories (route, stages done, skipped, open, evidence files) for the report's Qualidade section. |
| `docs/executive/README.md` | Procedure: what goes in the log, when to add an entry, commands, how to write the report from the sheet. |
| `docs/executive/log.jsonl` | The log itself. |
| `tests/exec-log.test.js` | Store rules (validation, secrets, idempotent key, open items) and the CLI. |
| `tests/exec-log-report.test.js` | Dossier reading and the new report sections (decisions, findings and corrections, approvals, quality, open items). |

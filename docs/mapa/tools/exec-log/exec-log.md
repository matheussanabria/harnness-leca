---
domain: tools
module: exec-log
feature: exec-log
summary: Executive log of outcomes, decisions and corrections, and the fact sheet an executive report is built from.
paths: [tools/exec-log.js, tools/lib/exec-log/*.js, tests/exec-log.test.js, docs/executive/README.md, docs/executive/log.jsonl]
keywords: [executive, report, log, journal, fact sheet, evidence, decisions, corrections, pending, metrics]
updated: 2026-11-22
---
# Executive log

How and when to write entries, and how to produce a report: `docs/executive/README.md`. The log is append-only JSON lines; each entry points to proof (a file or a commit), and `verify` fails when the proof is missing.

| File | Responsibility |
|---|---|
| `tools/exec-log.js` | CLI: `add`, `list`, `verify`, `report --from --to [--epic] [--out]`. |
| `tools/lib/exec-log/store.js` | Entry kinds and limits, validation (reports every problem, refuses secrets and personal data), idempotent append by `key`, open items (pending and risks not resolved), evidence and duplicate-id checks. |
| `tools/lib/exec-log/facts.js` | Facts from git (commits by type, files, lines), story files and feature dossiers; git is injectable for tests. |
| `tools/lib/exec-log/render.js` | Fact sheet in markdown: totals, stories, dossiers, log sections, metrics table, open items, evidence index. |
| `docs/executive/README.md` | Procedure: what goes in the log, when to add an entry, commands, how to write the report from the sheet. |
| `docs/executive/log.jsonl` | The log itself. |
| `tests/exec-log.test.js` | Store rules, the CLI, git parsing and the fact sheet. |

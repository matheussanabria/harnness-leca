---
domain: tools
module: reporting
feature: exec-report
summary: Executive report of a period from the merges on main and each story's evidence section (pending items, open criteria).
paths: [tools/exec-report.js, tools/lib/exec-report/*.js, tests/exec-report.test.js]
keywords: [report, executive, relatorio, delivery, merges, pending, stories, progress]
updated: 2026-11-22
---
# Executive report

`npm run report -- --since 2026-11-19 [--until ...] [--out file.md]` builds a Markdown report in Portuguese (it is read by the user): stories delivered per epic with status and merge, other deliveries, pending items, open acceptance criteria and plan changes. It reads only git and the story files, so merge subjects (`Merge EP-23.05: ...`) and the evidence sections (`**Pendente:**`, `**Divergências:**`) must stay accurate.

| File | Responsibility |
|---|---|
| `tools/exec-report.js` | CLI: period (default last 7 days), branch, output file. |
| `tools/lib/exec-report/collect.js` | Merge subjects to story ids, story frontmatter, evidence bullets, open criteria, git totals. |
| `tools/lib/exec-report/render.js` | Markdown: summary, deliveries per epic (one row per story), pending, warnings, plan changes. |
| `tests/exec-report.test.js` | Subject parsing, pending only from its label, one row per story, planned stories skipped, warnings. |

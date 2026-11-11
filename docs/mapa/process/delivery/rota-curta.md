---
domain: process
module: delivery
feature: rota-curta
summary: Short delivery route rule (when, stages, BDD traceability) and the stage gate of the story done-check.
paths: [docs/delivery/rota-curta.md, tools/lib/scrum-cli/done-check-stages.js, tests/done-check-stages.test.js]
keywords: [rota curta, delivery, feature-delivery, bdd, dossie, done-check, stages, gate]
updated: 2026-11-11
---
# Delivery route and stage gate

| File | Responsibility |
|---|---|
| `docs/delivery/rota-curta.md` | Rule: which route (short or full), the short route stages, BDD ids `CP-nn` with `@auto`/`@manual`, and the exit gate. Stage list itself lives in the workflow catalog. |
| `tools/lib/scrum-cli/done-check-stages.js` | Finds the story dossier (`_status.md`, `story:` frontmatter), parses the stage table and reports each stage: done, or skipped with a reason; anything else is open. |
| `tests/done-check-stages.test.js` | Parser, done and skipped rules, and lookup by story key. |

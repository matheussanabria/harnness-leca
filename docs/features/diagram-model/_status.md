---
feature: diagram-model
story: EP-21.03
route: completa
updated: 2026-11-22
---
# diagram-model: pure model of the Mermaid diagram (EP-21.03)

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-21-diagramas-estruturados/21.03-modelo-mermaid.md` | |
| BDD (bdd) | done | | `02-bdd.feature` | CP-01 to CP-08, all @auto |
| Prototype (prototype) | skipped | Sem elemento visual novo | | pure model; the editor island is 21.04 |
| Modeling (modeling) | skipped | Contrato já definido no ADR-014 | | no new contract; mermaid@1 and the 64 KB cap exist since 21.01 and 21.02 |
| Development (dev) | done | | `ui/web/src/features/diagram/` | |
| Tests (tests) | done | | `tests/diagram-*.test.js` | real Mermaid in Chrome: `tests/diagram-browser.test.js` |
| Review (review) | done | | | self-review of the diff |
| Commit and PR (commit-pr) | done | | | merged into main (d76b255) on 2026-11-22 with the user's approval |

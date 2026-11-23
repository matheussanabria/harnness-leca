---
feature: diagram-editor
story: EP-21.04
route: completa
updated: 2026-11-23
---
# diagram-editor: Mermaid diagram island in the Design workspace (EP-21.04)

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-21-diagramas-estruturados/21.04-ilha-mermaid.md` | |
| BDD (bdd) | done | | `02-bdd.feature` | 13 scenarios, CP-01 to CP-13 (CP-13 manual) |
| Prototype (prototype) | done | | `03-prototype.html` | approved by the user on 2026-11-23; export is a menu only in the prototype, it works in the real island (21.03 exporters) |
| Modeling (modeling) | done | | `../../mapa/frontend/canvas/canvas-diagram-island.md` | wiring points mapped; catalog menu in the legacy shell, island is the editor only |
| Development (dev) | done | | `ui/web/src/islands/canvas-diagram/` | |
| Tests (tests) | done | | `tests/diagram-editor-*.test.js` | 33 new tests: logic with fakes (21), wiring (7), real browser (5), plus existing suites updated for 17 screens |
| Review (review) | open | | | |
| Commit and PR (commit-pr) | open | | | |

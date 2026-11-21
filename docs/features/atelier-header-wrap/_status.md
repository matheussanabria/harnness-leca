---
feature: atelier-header-wrap
story: EP-24.03-fix
route: curta
updated: 2026-11-21
---
# atelier-header-wrap: Atelier header wraps instead of clipping its buttons

Found while checking EP-24.03 (evidence of that story). Short route: one CSS file, no new screen, no contract change.

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-24-motion-design/24.03-player-atelier.md` | finding recorded in section 11 of 24.03 |
| BDD (bdd) | done | | `02-bdd.feature` | |
| Prototype (prototype) | skipped | Sem elemento visual novo | | existing buttons only wrap to a second row |
| Modeling (modeling) | skipped | Dispensada na rota curta | | |
| Development (dev) | done | | `ui/public/css/design/08-prototype-catalog.css` | |
| Tests (tests) | done | | `tests/atelier-header-overflow.test.js` | failed before the fix (5 clipped buttons), passes after; real Atelier at 1500 px: `evidence/` |
| Review (review) | done | | | self-review of the diff |
| Commit and PR (commit-pr) | open | | | awaits user approval to merge |

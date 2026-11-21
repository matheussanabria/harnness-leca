---
feature: motion-keyframes
story: EP-24.06
route: completa
updated: 2026-11-21
---
# motion-keyframes: timeline panel with editable keyframes

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-24-motion-design/24.06-painel-timeline-keyframes.md` | |
| BDD (bdd) | done | | `02-bdd.feature` | |
| Prototype (prototype) | done | | `03-prototype.html` | approved by the user on 2026-11-21 |
| Modeling (modeling) | skipped | Sem contrato novo além do ADR-018 | | saves reuse the motion PUT, now inside the Atelier history |
| Development (dev) | done | | `ui/public/js/modules/motion-timeline-panel.js` | |
| Tests (tests) | done | | `tests/motion-timeline-state.test.js`, `tests/motion-timeline-history.test.js`, `tests/motion-timeline-ui.test.js` | CP-24 and 50-track drag (59.9 fps) in the real Atelier: `evidence/` |
| Review (review) | done | | | found and fixed the HTTP method gate blocking motion PUT/DELETE (24.01, 24.05), a read-only Event write, and per-frame repaints |
| Commit and PR (commit-pr) | open | | | awaits user approval to merge |

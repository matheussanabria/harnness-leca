---
feature: motion-export
story: EP-24.05
route: completa
updated: 2026-11-21
---
# motion-export: video export of a screen timeline

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-24-motion-design/24.05-exportacao-video.md` | |
| BDD (bdd) | done | | `02-bdd.feature` | |
| Prototype (prototype) | done | | `03-prototype.html` | approved by the user on 2026-11-21 |
| Modeling (modeling) | done | | `../../harness-evolution/03-decisions/ADR-018-motion-timeline-format.md` | spike recorded in the ADR |
| Development (dev) | done | | `ui/server/services/motion-export-run.service.js`, `ui/public/js/modules/prototype-motion-export.js` | |
| Tests (tests) | done | | `tests/motion-export-queue.test.js`, `tests/motion-export-capture.test.js`, `tests/prototype-motion-export.test.js` | CP-20 checked in the real Atelier (GIF exported and downloaded): `evidence/` |
| Review (review) | done | | | self-review; fixed job starting before its run spec and the timeout timer holding the process |
| Commit and PR (commit-pr) | open | | | awaits user approval to merge |

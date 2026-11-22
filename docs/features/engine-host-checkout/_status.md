---
feature: engine-host-checkout
story: EP-23.07
route: completa
updated: 2026-11-22
---
# engine-host-checkout: engine host per checkout (EP-23.07)

| Stage | Status | Reason | File | Note |
|---|---|---|---|---|
| Start (start) | done | | `_status.md` | |
| Story (story) | done | | `../../harness-evolution/02-epics/EP-23-host-execucao-persistente/23.07-host-por-checkout.md` | |
| BDD (bdd) | done | | `02-bdd.feature` | CP-01 to CP-05, all @auto |
| Prototype (prototype) | skipped | Sem elemento visual novo | | no screen; only error messages and a CLI exit code |
| Modeling (modeling) | done | | `../../harness-evolution/02-epics/EP-23-host-execucao-persistente/23.07-host-por-checkout.md` | the new GET /identity contract is specified in the story |
| Development (dev) | done | | `ui/server/services/engine-host/checkout-port.js` | |
| Tests (tests) | done | | `tests/engine-host-checkout.test.js` | CP-01, CP-02 and CP-04 fail on the old code, pass on the new |
| Review (review) | done | | | self-review of the diff |
| Commit and PR (commit-pr) | done | | | merged into main on 2026-11-22 |

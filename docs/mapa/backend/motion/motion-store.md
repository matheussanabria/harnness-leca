---
domain: backend
module: motion
feature: motion-store
summary: motion@1 timeline validator, disk store with rev check and GET/PUT motion routes for Atelier screens (EP-24.01).
paths: [ui/server/services/motion-*.service.js, ui/server/controllers/motion.controller.js, tests/motion-*.test.js]
keywords: [motion, timeline, keyframes, animation, atelier, motion@1, rev, adr-018]
updated: 2026-11-21
---
# Motion timeline store

Format and rules: `docs/harness-evolution/03-decisions/ADR-018-motion-timeline-format.md`. Routes live in `ui/server/routes/design.routes.js`.

| File | Responsibility |
|---|---|
| `ui/server/services/motion-schema.service.js` | Pure motion@1 validator (header limits, allowed props, safe values, ease, increasing key times, duplicate targets) with orphan tracks as warnings; `extractPids` reads a screen's data-pid values. |
| `ui/server/services/motion-store.service.js` | Resolves the screen from proto.json, reads and writes `screens/<screen>.motion.json` atomically, 64 KB cap, `rev` (12-hex sha256) conflict check, typed `MotionError`. |
| `ui/server/controllers/motion.controller.js` | `GET` and `PUT /api/project/:slug/design/prototypes/:protoId/motion/:screenId`; PUT needs `postOk`, body `{ doc, rev }`, errors as `{ error, code, ...details }`. |
| `tests/motion-schema.test.js` | Validator rules, CP-02 and CP-03. |
| `tests/motion-store.test.js` | Store and routes through the router: CP-01, CP-04, 422, 413, 404, path escape. |

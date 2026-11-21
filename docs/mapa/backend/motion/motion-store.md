---
domain: backend
module: motion
feature: motion-store
summary: motion@1 validator, store, routes, iframe WAAPI runtime, agent tools and probe (EP-24.01, 24.02, 24.04).
paths: [ui/server/services/motion-*.service.js, ui/server/controllers/motion.controller.js, ui/public/js/modules/prototype-bridge-motion.js, tests/motion-*.test.js, tests/prototype-bridge-motion.test.js, tools/motion-probe.js]
keywords: [motion, agent, tools, probe, timeline, runtime, waapi, seek, bridge, keyframes, animation, atelier, motion@1, rev, adr-018]
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
| `ui/server/services/motion-render.service.js` | Appends the timeline as inert JSON (script-safe escaping) plus the runtime to a rendered screen, only when its `.motion.json` is valid; the sandbox renderer calls it. |
| `ui/public/js/modules/prototype-bridge-motion.js` | Iframe runtime: `toKeyframes` (exported for tests), one paused Web Animation per track driven by `currentTime`, `HARNESS_MOTION_SEEK/PLAY/PAUSE/LOAD` in, `READY/TIME/SEEKED/ENDED` out, `window.__harnessMotion` for export. |
| `tests/prototype-bridge-motion.test.js` | Keyframe conversion, conditional injection (CP-06), script-safe JSON, and a real-browser iframe seek (CP-05, CP-07; skipped without Chrome or Edge). |
| `ui/server/services/motion-tools.service.js` | Agent tools `motion_write_timeline`, `motion_set_keys`, `motion_remove_track` (through the store), `MOTION_RULES` prompt text, validation errors returned to the model; registered in `atelier-tools.service.js`. |
| `ui/server/services/motion-context.service.js` | Timeline summary for the agent prompt (one line per track, about 200 tokens, content hash); `atelier-proto-context.service.js` appends it. |
| `tools/motion-probe.js` | Real-model probe: real prompt, motion tags applied with the app tools, one retry with the errors; markdown report. |
| `tests/motion-tools.test.js` | Tools through `executeAtelierTool` and the tag parser: CP-12, CP-13, track replace/remove, orphan warnings, catalog and instruction. |
| `tests/motion-context.test.js` | Summary format, CP-14 budget, hash, and the proto context block. |

---
domain: backend
module: motion
feature: motion-export
summary: Motion video export (EP-24.05): headless capture, WebCodecs encoding (mediabunny, gifenc), job queue and routes.
paths: [ui/server/services/motion-export-*.service.js, ui/server/services/motion-export-encoder.browser.js, ui/server/controllers/motion-export.controller.js, tests/motion-export-*.test.js]
keywords: [motion, export, video, mp4, webm, gif, webcodecs, mediabunny, gifenc, playwright, queue]
updated: 2026-11-21
---
# Motion export

Decision and spike: `docs/harness-evolution/03-decisions/ADR-018-motion-timeline-format.md`. Routes live in `ui/server/routes/design.routes.js`; setup in `SETUP.md` (Motion export).

| File | Responsibility |
|---|---|
| `ui/server/services/motion-export-capture.service.js` | Opens the screen's own render URL at top level (only its origin and the font/icon CDNs), waits for `__harnessMotion.ready`, then seek plus screenshot per frame. |
| `ui/server/services/motion-export-encode.service.js` | Opens the encoder page on a localhost origin served only through `page.route` (encoder script, mediabunny, gifenc from node_modules); probe, start, frame, finish, cancel. |
| `ui/server/services/motion-export-encoder.browser.js` | Browser-side encoder: PNG frames to an OffscreenCanvas, MP4 (H.264) or WebM (VP9) via mediabunny `CanvasSource`, GIF via gifenc; returns the file as base64. |
| `ui/server/services/motion-export-run.service.js` | One export: frame plan (`round(duration * fps)` frames), even output size from `size` and scale, streaming capture to encoder, abort checks, atomic file write. |
| `ui/server/services/motion-export-queue.service.js` | Jobs: one running per project (others queued), cancel, 10-minute timeout (unref timer), finished-job pruning, and cleanup of export files older than 24 h. |
| `ui/server/controllers/motion-export.controller.js` | POST `.../motion/:screen/export`, GET/DELETE `.../motion/export/:jobId`, GET `.../file` (attachment) and GET `.../motion/export-formats` (probed once per process). |
| `tests/motion-export-queue.test.js` | Queue rules without a browser: CP-17, CP-18 (queue), CP-19, timeout, cleanup, request options. |
| `tests/motion-export-capture.test.js` | Real exports through the router and Chrome: CP-16 (WebM 24 frames, 1 s), MP4/GIF headers, CP-18 cancel, the HTTP API end to end. |

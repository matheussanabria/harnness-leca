# ADR-018: Motion design is declarative data on top of Atelier screens

- Status: accepted (EP-24, story 24.01, 2026-11-21)
- Date: 2026-11-21
- Related: ADR-010 (Atelier agent loop), ADR-014 (native formats), EP-12 (prototype engine), EP-15 (Atelier agent runtime)

## Context
The Atelier already renders prototype screens (HTML/CSS/SVG) in a sandboxed iframe (`sandbox="allow-scripts"`), injects a stable `data-pid` on every element (`prototype-sanitizer.service.js`), exposes a layer tree, and lets agents edit screens through `<tool name=...>` tags (`atelier-tools.service.js`). There is no notion of time: a screen is a static state. We want motion design (animated compositions exportable as video) without a second editor, a heavy animation library, or free-form animation code written by the model.

`playwright-core` is a dependency and `tools/atelier-pilot/lib/browser.js` launches the installed Chrome or Edge. `ffmpeg` is not installed on the reference machine.

## Decision
1. **A composition is an Atelier screen plus a timeline file.** The screen HTML stays the visual source; the timeline lives at `screens/<screen-id>.motion.json` next to it. A screen without that file behaves exactly as today.
2. **Format `motion@1`**, declarative and validated on the server:
   ```json
   { "schema": "motion@1", "duration": 4000, "fps": 30, "loop": false,
     "size": { "w": 1920, "h": 1080 },
     "tracks": [
       { "target": "p-12", "keys": [
         { "t": 0,   "props": { "opacity": 0, "transform": "translateY(24px)" } },
         { "t": 600, "props": { "opacity": 1, "transform": "translateY(0)" }, "ease": "ease-out" } ] } ] }
   ```
   - `target` is a `data-pid` (e.g. `p-12`). Selectors and free scripts are not accepted. Each track has a unique target and 1 to 100 keys.
   - `t` in milliseconds, `0 <= t <= duration`, strictly increasing per track.
   - Allowed props (whitelist): `opacity`, `transform`, `color`, `background-color`, `filter`, `clip-path`, `stroke-dashoffset`, `width`, `height`, `border-radius`. Unknown props are rejected, not dropped.
   - `ease`: CSS keywords or `cubic-bezier(...)`, applied to the segment that ends at that key.
   - Limits: `duration <= 60000`, `fps` in `{24, 30, 60}`, at most 200 tracks, 64 KB per file.
3. **Runtime is the Web Animations API**, with no third-party animation library. A small script injected by the sandbox builds one paused `Animation` per track and exposes `seek(ms)`, `play()`, `pause()` through `HARNESS_MOTION_*` messages on the existing bridge. Rendering at time `t` is deterministic: the same `t` always yields the same frame.
4. **Agents edit data, not code.** New tags `motion_write_timeline` (full file) and `motion_set_keys` (patch one track) go through the same parser, guard and validator path as the Atelier tags. The agent context gets a compact timeline summary (tracks, durations), capped like the proto map.
5. **Export runs in headless Chrome with no ffmpeg dependency.** A server job opens the render URL with Playwright, waits for `document.fonts.ready`, calls `seek(frame * 1000 / fps)` for each frame, takes a screenshot, and encodes the frames in a headless page with WebCodecs plus a muxer library pinned to an exact version (chosen in the 24.05 spike). The output is WebM (VP9) by default, MP4 (H.264) when the encoder supports it, and GIF as a fallback. If `ffmpeg` is on PATH it may be used instead, but it is never required.
6. **Lottie export is out of scope** for this epic.

## Consequences
- The sandbox, the layer tree and the version history work for motion without change, since the screen is still plain HTML.
- `data-pid` becomes a contract for motion: an edit that removes an element leaves an orphan track, which the validator reports (it does not delete the track silently).
- Frame-by-frame screenshots are slow (about 30 to 80 ms per frame); a 10 s, 30 fps export is about 300 frames. That is acceptable for a background job with progress, but not for live preview, which uses the runtime directly.
- No new heavy dependency: one pinned muxer and optionally a GIF encoder.

## Alternatives considered
- **GSAP or another animation library:** more expressive, but adds license and bundle weight, and models would write imperative code that is hard to validate and patch.
- **CSS `@keyframes` written into the screen:** no extra file, but the timeline is scattered across CSS, there is no frame-exact seeking, and patches are fragile.
- **Playwright `recordVideo`:** simple, but records in real time with dropped frames and no exact frame control.
- **Requiring ffmpeg:** the best encoder, but an extra install on every machine and on the VPS image.

## Implementation notes (24.01)
- Prop values are numbers or CSS strings up to 200 characters; `<`, `>`, `{`, `}`, `;`, `\`, `url(`, `expression(` and `@import` are rejected, so a timeline can never load an external resource.
- `size` sides are integers from 16 to 3840.
- `rev` is the first 12 hex characters of the sha256 of the stored file. Writing over an existing file requires its current `rev`; a new file accepts only `rev: null`.
- Routes: `GET` and `PUT /api/project/:slug/design/prototypes/:protoId/motion/:screenId`, errors `{ error, code, ... }` with 400, 404, 409, 413 and 422.

## Export spike (24.05, 2026-11-21)
- Headless Chrome on the reference machine (Windows) reports `VideoEncoder` support for VP9, VP8, H.264 (avc1.640028 and avc1.42001f) and AV1 at 1080p, on a `localhost` origin (WebCodecs needs a secure context).
- Muxer: `mediabunny` pinned at **1.65.2** (MPL-2.0, released 2026-11-04). It is the maintained successor of `webm-muxer` and `mp4-muxer` (the latter is marked deprecated in favor of it) and writes both MP4 and WebM. GIF: `gifenc` pinned at **1.0.3** (MIT).
- The encoder page is served only to the job's headless page through `page.route` on a localhost origin; it is not on the public static server. Frames go one at a time as PNG, so memory stays flat.
- ffmpeg is not used. Decision 5 allowed it as an option; with H.264 available in WebCodecs it adds nothing, so it was left out (MP4 is simply not offered when the encoder lacks H.264).
- Measured: 10 s, 30 fps, 1920x1080, 300 frames: 46 s to MP4 (0.67 MB), 48 s to WebM (0.45 MB); target was under 2 minutes.

---
domain: backend
module: atelier
feature: atelier-tools
summary: Atelier server services that inject prototype context into agent runs and parse model tool tags, with tests.
paths: [ui/server/services/atelier-screen-map.service.js, ui/server/services/atelier-screen-map-disk.service.js, tests/atelier-screen-map.test.js, ui/server/services/atelier-proto-map.service.js, tests/atelier-proto-map.test.js, ui/server/services/atelier-proto-context.service.js, ui/server/services/atelier-nav-contract.service.js, ui/server/services/atelier-tool-tags.service.js, tests/atelier-proto-context.test.js, tests/atelier-nav-contract.test.js, tests/atelier-tool-tags.test.js, ui/server/services/atelier-engine-adapters.service.js, ui/server/services/prototype-sanitizer.service.js, ui/server/services/atelier-screen-guards.service.js, tests/atelier-screen-guards.test.js, tests/atelier-opencode-session-resume.test.js, tests/prototype-atelier.test.js]
keywords: [atelier, prototype, context, tool tags, atelier_write_screen, atelier_patch_styles, navigation]
updated: 2026-11-02
---
# Atelier Tools

| File | Responsibility |
|---|---|
| `ui/server/services/atelier-screen-guards.service.js` | Pre-write check for `atelier_write_screen`: rejects leaked `<tool>` tags, duplicated `lp-app` roots and inline scripts with syntax errors. |
| `tests/atelier-screen-guards.test.js` | Guard rules plus data-pid injection leaving script/style bodies untouched. |
| `ui/server/services/atelier-proto-context.service.js` | Reads prototype state from disk on each agent run and builds the prompt block so stage 2 continues stage 1. |
| `ui/server/services/atelier-nav-contract.service.js` | Shared navigation contract (`data-action="goto:<screen-id>"`), valid screen ID line, and nav graph extraction (edges and broken targets) for the three Atelier generation paths. |
| `ui/server/services/atelier-proto-map.service.js` | Compact prototype map (screens, nav graph, storage keys, CSS classes, components; capped under 300 tokens) plus a 12-hex content hash so the agent detects a changed prototype. |
| `ui/server/services/atelier-screen-map.service.js` | Pure per-prototype map from proto.json plus screen HTML: screens, links (`data-action="goto:"` and `a[href]`, classified by the shared `resolveScreenTarget`), missing targets, orphan screens, unregistered and file-less screens. |
| `ui/server/services/atelier-screen-map-disk.service.js` | Read-only disk adapter: `loadScreenMap({projectDir, protoId})` reads proto.json and screens/*.html, then calls the pure builder. |
| `tests/atelier-screen-map.test.js` | Link extraction, graph, missing targets, orphans (a self link does not count), entry rules, empty input, disk adapter. |
| `tests/atelier-proto-map.test.js` | Map contents, hash stability and sensitivity, nav graph, and the 300-token budget. |
| `tests/atelier-proto-context.test.js` | Context block contents, empty prototype, and loop delivery (model gets context, event shows only the request). |
| `tests/atelier-nav-contract.test.js` | Navigation contract text, screen ID line, and its presence in the proto context and chat rules. |
| `ui/server/services/atelier-tool-tags.service.js` | Parses `<tool name=...>` tags: raw HTML/CSS for `atelier_write_screen`/`atelier_patch_styles`, repaired JSON, unreadable tags returned as errors. |
| `tests/atelier-tool-tags.test.js` | Tag parser (JSON, repaired JSON, raw HTML/CSS, errors) and `cssRules`/`cssContent` + `atelier_parse_error` tools. |
| `ui/server/services/atelier-engine-adapters.service.js` | Gemini and OpenCode model turns for the agent loop; resumes the engine session and drops it only when the server answers 404/410 (`isSessionGone`), so auth or network errors never silently open a new session. |
| `ui/server/services/prototype-sanitizer.service.js` | Strips dangerous tags, inline handlers and unsafe URIs from screen HTML; keeps `<form>` content and blocks only submission (`action`/`method` removed, `onsubmit` blocked). |
| `tests/atelier-opencode-session-resume.test.js` | Session resume rules: 401/400 keep the session and emit `session_check_failed`, 404 creates a new one, healthy session is reused. |
| `tests/prototype-atelier.test.js` | Sanitizer (scripts, handlers, iframes, forms kept and neutralized), data-pid injection, storage and versions. |
| `tests/prototype-sanitizer-pid.test.js` | data-pid injection: slash after the id on self-closing SVG tags, void tags, repair of old malformed output, idempotence. |

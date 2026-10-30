---
domain: backend
module: atelier
feature: atelier-tools
summary: Atelier server services that inject prototype context into agent runs and parse model tool tags, with tests.
paths: [ui/server/services/atelier-proto-context.service.js, ui/server/services/atelier-tool-tags.service.js, tests/atelier-proto-context.test.js, tests/atelier-tool-tags.test.js]
keywords: [atelier, prototype, context, tool tags, atelier_write_screen, atelier_patch_styles]
updated: 2026-10-30
---
# Atelier Tools

| File | Responsibility |
|---|---|
| `ui/server/services/atelier-proto-context.service.js` | Reads prototype state from disk on each agent run and builds the prompt block so stage 2 continues stage 1. |
| `tests/atelier-proto-context.test.js` | Context block contents, empty prototype, and loop delivery (model gets context, event shows only the request). |
| `ui/server/services/atelier-tool-tags.service.js` | Parses `<tool name=...>` tags: raw HTML/CSS for `atelier_write_screen`/`atelier_patch_styles`, repaired JSON, unreadable tags returned as errors. |
| `tests/atelier-tool-tags.test.js` | Tag parser (JSON, repaired JSON, raw HTML/CSS, errors) and `cssRules`/`cssContent` + `atelier_parse_error` tools. |

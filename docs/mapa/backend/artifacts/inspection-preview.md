---
domain: backend
module: artifacts
feature: inspection-preview
summary: Artifact inspection, DC sandbox, inventory, import, preview, links, routines tab and related tests.
paths: [ui/server/services/prototype-exporter-runtime.service.js, ui/server/services/prototype-artifact-import.service.js, ui/server/services/dc-*.service.js, ui/server/services/prototype-sandbox-*.service.js, ui/server/controllers/artifact*.js, ui/server/services/artifact-*.service.js, ui/public/js/modules/design-artifacts-*.js, ui/public/js/modules/design-routines*.js, tests/artifact-*.test.js, tests/deploy-*.test.js]
keywords: [artifact, preview, sandbox, dc, inventory, import, relationships, routines, deploy]
updated: 2026-10-30
---
# Artifact inspection, preview and links

| File | Responsibility |
|---|---|
| `ui/server/services/prototype-artifact-import.service.js` | Turns an artifact into an inspection copy without changing the source: static HTML to `screens/home.html`, `.dc.html` to `dc/` parts. |
| `ui/server/services/dc-artifact-adapter.service.js` | Facade of the `.dc.html` (Claude Design) adapter over `dc-runtime-config`, `dc-artifact-parser` and `dc-inspection-writer`. |
| `ui/server/services/dc-runtime-config.service.js` | Accepted runtime hashes (`support.js`, React SRI) and verification of `ui/public/js/vendor/dc-runtime/`; altered runtime is refused. |
| `ui/server/services/dc-artifact-parser.service.js` | Reads `.dc.html` (template, helmet, logic, `data-props`), validates it (no `import`/`require`, no `</script`) and finds relative assets. |
| `ui/server/services/dc-inspection-writer.service.js` | Writes `dc/template.html`, `logic.js`, `helmet.html`, `manifest.json`, `dc/assets/`; idempotent by hash, validation block gives 422. |
| `ui/server/services/prototype-sandbox-renderer.service.js` | Prototype sandbox facade: `metadata.runtime === "dc"` goes to the DC branch, others to `screens/<id>.html`. |
| `ui/server/services/prototype-sandbox-dc.service.js` | Renders a DC prototype with local runtime, sandbox CSP, `startScreen.default`, data URI assets, stable `data-pid`, React loaded before boot. |
| `ui/server/services/dc-template-runtime.service.js` | Encodes `sc-for` and `sc-if` as `<template>` nodes before HTML parsing so loops inside tables render mock rows. |
| `ui/server/services/prototype-exporter-runtime.service.js` | JS embedded in the single-HTML export: screen resolver equal to the ESM one, `a[href]` and `goto:` handling, on-page warning for planned screens, global `showScreen` for the tabs. |
| `ui/server/services/prototype-sandbox-common.service.js` | Styles, harness bridge and CSP headers shared by the static and DC sandbox branches. |
| `ui/public/js/vendor/dc-runtime/` | React 18.3.1, ReactDOM 18.3.1 and Claude Design `support.js` with checked hashes, served to the isolated sandbox. |
| `ui/server/services/artifact-inventory.service.js` | Deduplicates, merges metadata, filters local access, sorts, summarizes and limits the artifact inventory. |
| `tests/artifact-inventory.test.js` | Covers the seven types, states, symlink, limit, controller and file limits. |
| `tests/artifact-import.test.js` | Covers import, collision, security, controller, binary route and file limits. |
| `tests/artifact-metadata.test.js` | Covers manifest, checksum, local/project access, remote filter, controller, route and file limits. |
| `tests/artifact-preview.test.js` | Covers text, HTML, image, PDF, remote access, invalid manifest, controller, route and limits. |
| `tests/artifact-relationships.test.js` | Covers stable key, add/remove, orphans, remote filter, controller, routes and limits. |
| `tests/capability-catalog.test.js` | Covers versioned catalog, states, `resolveCapability`, legacy fields, endpoints and limits (EP-08.01). |
| `tests/agent-stage-catalog.test.js` | Covers canonical SDLC stages, agent roles, stage/agent queries, endpoints and limits (EP-08.02). |
| `tests/skill-bindings.test.js` | Covers versioned manifest, resolution, orphans, loopback, endpoints and file limits (EP-08.03). |
| `tests/workflow-runner.test.js` | Covers workflow catalog, policies, per-project plan, lifecycle events, failure, cancel and dryRun (EP-08.04). |
| `tests/workflow-http.test.js` | Covers workflow and run endpoints, loopback, errors, registered routes and file limits (EP-08.04). |
| `tests/routine-runner.test.js` | Covers routine catalog, triggers, idempotency key, sensitive-step approval/rejection and history (EP-08.05). |
| `tests/routine-http.test.js` | Covers routine, approval, decision and history endpoints with loopback, errors and limits (EP-08.05). |
| `tests/routine-ui.test.js` | Covers the Routines tab: registered tab, `design.js` dispatch, stylesheet, FontAwesome, no emoji (EP-08.05). |
| `tests/deploy-pipeline.test.js` | Covers pipeline model, manifest, staged execution, confirmation, webhook masking and endpoints (EP-10.01). |
| `tests/deploy-status.test.js` | Covers operational summary, unknown state, API contract and parity between both surfaces (EP-10.05). |
| `tests/deploy-actions.test.js` | Covers action catalog, time-boxed single-use authorization, confirmation, dry run and execution (EP-10.04). |
| `tests/deploy-timeline.test.js` | Covers unified timeline, filters, corrupted history and per-run logs (EP-10.03). |
| `tests/deploy-health.test.js` | Covers check model, manifest, http and command checks, per-environment aggregate and endpoints (EP-10.02). |

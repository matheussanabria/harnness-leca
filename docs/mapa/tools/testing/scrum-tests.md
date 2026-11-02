---
domain: tools
module: testing
feature: scrum-tests
summary: Tests for Scrum sources, migration, lanes, transitions, impediments, design screen state and project selection.
paths: [tests/project-scrum-*.test.js, tests/design-scrum-*.test.js, tests/scrum-impediments-metrics.test.js, tests/design-screen-state.test.js, tests/project-selection.test.js]
keywords: [tests, scrum, lanes, transitions, impediments, metrics, project-selection, jira]
updated: 2026-11-01
---
# Scrum and Project Tests

| File | Responsibility |
|---|---|
| `tests/project-scrum-sources.test.js` | Faithful Jira normalization, ordered document parsing, reconciliation without fake defaults, legacy mapping compatibility. |
| `tests/project-scrum-migration.test.js` | Covers schema v2, idempotence, unknown status, backup, atomic write, rollback and lane coherence. |
| `tests/project-scrum-lanes.test.js` | Covers lane catalog, configuration, permutation, persistence and optimistic revision in temp dirs. |
| `tests/project-scrum-lane-order.test.js` | Covers lane order and story invariants in temporary directories. |
| `tests/design-scrum-lane-order.test.js` | Validates hidden lanes, shared endpoint, accessible controls, announcement and focus restoration. |
| `tests/project-scrum-transitions.test.js` | Covers transition matrix, legacy status, history, conflict and Jira origin. |
| `tests/design-scrum-transitions.test.js` | Covers drag, keyboard, focus and announcements of transitions. |
| `tests/scrum-impediments-metrics.test.js` | Covers activation with reason, idempotence, history, block summary, filters, lane metrics and UI structure (EP-05.05). |
| `tests/design-screen-state.test.js` | Covers snapshot, apply, hydration, persistence and log of Scrum, Layers, Board and Audit screens; no emoji, 300-line limit (EP-14.09). |
| `tests/project-selection.test.js` | Covers precedence, canonicalization, persistence, rollback and atomic write of the active project. |
| `tests/design-scrum-details.test.js` | Validates panel, dynamic projection by `laneId`, accessible modal, relationships and status mapping. |
| `tests/design-scrum-story-trace.test.js` | Drawer trace section: escaped markup for maturity, DoR and commits, encoded route URLs, error state and stale-answer guard. |
| `tests/project-scrum-maturity.test.js` | Maturity default and gate: drafts stay out of the sprint, DoR required for `ready`, partial payloads keep stored fields, backlog edits do not move sprints. |
| `tests/project-scrum-commits.test.js` | Trailer parsing and the git reader on temporary repositories, including hostile ids, branches, clamping and `GIT_*` hygiene. |
| `tests/project-scrum-dor.test.js` | Mechanical Definition of Ready: required and advisory checks, boundaries, robustness, determinism. |
| `tests/project-scrum-trace-http.test.js` | The `/commits` and `/dor` routes end to end, repo isolation, 404s and the remote-access gate. |
| `tests/project-scrum-duplicates.test.js` | Normalization and duplicate candidates: key aliases, accents, threshold boundary, cap, empty store, immutability. |
| `tests/project-scrum-capture.test.js` | Draft capture: forced draft and null sprint, idempotent `dedupeKey`, ignored `storyRevision`, suggestions that never block, 400 without a title. |

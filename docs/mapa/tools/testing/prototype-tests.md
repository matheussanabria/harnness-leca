---
domain: tools
module: testing
feature: prototype-tests
summary: Tests for design registry, tokens, prototype pipeline, codegen and milestone validations M1 to M3.
paths: [tests/design-registry*.test.js, tests/design-tokens.test.js, tests/design-preview.test.js, tests/marco-m*-validation.test.js, tests/prototype-*.test.js]
keywords: [tests, prototype, design-registry, codegen, sandbox, canvas, marco, studio]
updated: 2026-10-30
---
# Design and Prototype Tests

| File | Responsibility |
|---|---|
| `tests/design-registry.test.js` | Unit validation of manifests, component CRUD, frameworks and the `AnnotationList` pilot. |
| `tests/design-registry-routes.test.js` | Integration of REST endpoints `/api/project/:slug/design/registry`. |
| `tests/design-tokens.test.js` | CSS tokens/theme isolation. |
| `tests/design-preview.test.js` | Preview sandbox with ES modules. |
| `tests/marco-m1-validation.test.js` | Formal validation suite of Milestone M1 (Reliable Extraction). |
| `tests/prototype-schema.test.js` | Formal validation of schema v2. |
| `tests/prototype-state.test.js` | Validation of hierarchical state. |
| `tests/prototype-validator.test.js` | Validation of DIS clinical mocks. |
| `tests/prototype-semantic-parser.test.js` | Semantic parsing of x-import tags. |
| `tests/prototype-screen-decomposer.test.js` | Screen decomposition. |
| `tests/prototype-reconstruction.test.js` | Rebuild of a clean prototype. |
| `tests/prototype-sandbox-renderer.test.js` | Safe sandbox renderer with restrictive CSP. |
| `tests/prototype-bridge.test.js` | Bidirectional postMessage bridge. |
| `tests/prototype-layer-tree.test.js` | Layer tree. |
| `tests/prototype-canvas-model.test.js` | Canvas document: one frame per screen, cursor zoom, fit, hit-test, Play order, persistence, block preview. |
| `tests/marco-m2-validation.test.js` | Formal suite of Milestone M2 (Inspectable Prototype with non-destructive mutation). |
| `tests/prototype-codegen-vanilla.test.js` | Clean code generation for Vanilla (HTML/CSS/JS). |
| `tests/prototype-codegen-angular.test.js` | Code generation for Angular 18 (Signals and Standalone). |
| `tests/prototype-codegen-react.test.js` | Code generation for React 18+ (Hooks and TSX). |
| `tests/prototype-codegen-parity.test.js` | Semantic parity matrix across frameworks. |
| `tests/prototype-studio.test.js` | Virtual workspace projection with SHA-256 hashes in the Studio. |
| `tests/prototype-traceability.test.js` | Resolution of the Screen -> Node -> Component -> Code graph. |
| `tests/prototype-element-map.test.js` | Element to file/component mapping (EP-06.05). |
| `tests/prototype-pilot-dis.test.js` | Working DIS clinical flow with 3 screens (`home`, `prescricao`, `autorizacao`), circular navigation, real datasets. |
| `tests/marco-m3-validation.test.js` | Formal suite of Milestone M3 (Multiframework Studio) covering all of EP-12. |

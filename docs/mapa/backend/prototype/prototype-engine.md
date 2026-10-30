---
domain: backend
module: prototype
feature: prototype-engine
summary: Prototype schema V2, state and mocks, validator, semantic parser, screen decomposer, rebuilder and DIS pilot.
paths: [ui/server/services/prototype-*.service.js, ui/server/services/prototype-structural.service.js]
keywords: [prototype, schema, state, mocks, validator, parser, decomposer, reconstructor, dis]
updated: 2026-10-30
---
# Prototype Engine

| File | Responsibility |
|---|---|
| `ui/server/services/prototype-schema.service.js` | Creates, manipulates and normalizes semantic nodes (`PrototypeNode`), slots, events and O(1) indexing. |
| `ui/server/services/prototype-state.service.js` | Global and local state, `{{var}}` interpolation, bindings and mock datasets. |
| `ui/server/services/prototype-validator.service.js` | Strict validator for referential integrity, metadata, node trees and navigation targets. |
| `ui/server/services/prototype-semantic-parser.service.js` | Parses fragments and `<x-import>` tags, mapping global DataChef components to canonical Registry IDs. |
| `ui/server/services/prototype-screen-decomposer.service.js` | Splits monolithic flows into clean independent screens with `data-node-id` attributes for 1:1 visual inspection. |
| `ui/server/services/prototype-reconstructor.service.js` | Full rebuild pipeline: emits `proto.json` v2.0.0, `screens/` and `data/` folders, and validates conformance. |
| `ui/server/services/prototype-pilot-dis.service.js` | Idempotently rebuilds the three DIS pilot screens and navigation after semantic reconstruction. |
| `ui/server/services/prototype-structural.service.js` | Structural edits on prototype screens with fingerprint check, unified diff and `data-pid` injection. |

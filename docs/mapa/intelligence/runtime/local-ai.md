---
domain: intelligence
module: runtime
feature: local-ai
summary: Harness Local AI Runtime (phases 1 and 2): Ollama client, classifier, extractor, shadow mode and telemetry.
paths: [docs/harness-runtime/*.md, schemas/runtime-extraction.schema.json, tools/lib/runtime/*.js, ui/public/js/modules/chat-hia-local-runtime.js, tests/runtime-*.test.js, tests/hia-local-runtime-panel.test.js]
keywords: [runtime, ollama, local-ai, classifier, extractor, shadow, telemetry, structured-extraction]
updated: 2026-10-30
---
# Local AI Runtime

| File | Responsibility |
|---|---|
| `docs/harness-runtime/00-index.md` | Master index, Mermaid graph and governance of Local Runtime phase 1. |
| `docs/harness-runtime/00-index-fase2.md` | Master index, contracts and epics of phase 2 (Structured Extraction and HIA Router). |
| `schemas/runtime-extraction.schema.json` | JSON Schema Draft-07 contract for structured extraction of decisions, rules and terms. |
| `tools/lib/runtime/ollama-client.js` | Resilient Ollama HTTP client: health check, tags, structured JSON (`generateStructured`) and free text (`generateText`). |
| `tools/lib/runtime/ollama-cli.js` | Synchronous local engine runner: reads the prompt from stdin and writes the daemon response to stdout. |
| `tools/lib/runtime/schema.js` | Strict validator of the canonical task classification contract. |
| `tools/lib/runtime/classifier.js` | Deterministic service for classifying local tasks. |
| `tools/lib/runtime/extractor.js` | Structured knowledge extraction service with schema validation. |
| `tools/lib/runtime/shadow.js` | Non-blocking async interceptor for shadow mode with zero cloud fallback. |
| `tools/lib/runtime/telemetry.js` | Sanitized append-only JSONL inference metrics and `getRuntimeTelemetryMetrics` aggregation. |
| `ui/public/js/modules/chat-hia-local-runtime.js` | HIA panel block with local runtime metrics: inferences, validity, tokens, duration and distributions. |
| `tests/runtime-local.test.js` | Phase 1 unit test battery with mocks. |
| `tests/runtime-fase2.test.js` | Phase 2 unit tests for extraction and HIA delegation. |
| `tests/runtime-ollama-engine.test.js` | Tests of the local engine path (free text, JSON format and runner) with a fake daemon. |
| `tests/hia-local-runtime-panel.test.js` | Rendering tests of the local runtime block in the HIA panel. |

---
domain: telemetry
module: program
feature: plan-adrs
summary: Telemetry program planning docs - pre-plan, consolidated plan, diagnostics A1-A5 and ADR-TEL-001 to 007.
paths: [docs/harness-telemetria/**, docs/harness-telemetria-resumo-executivo-pre-plano.md, tests/office-agent-concurrency.test.js]
keywords: [telemetry, plan, diagnostics, adr, ep-09, accounting, privacy]
updated: 2026-10-30
---
# Telemetry plan, diagnostics and ADRs

| File | Responsibility |
|---|---|
| `docs/harness-telemetria-resumo-executivo-pre-plano.md` | Pre-plan v0.1: scope, entity model, accounting rules, phases P0-P5 and the planning briefing. |
| `docs/harness-telemetria/00-plano-consolidado.md` | Consolidated diagnosis, decisions, additive event contract over EP-09, engine matrix, ADR drafts, backlog T0-T5, delegation plan. |
| `docs/harness-telemetria/diagnostico/A1-ep09-overlap.md` | Matrix of what EP-09 already covers versus the pre-plan, plus projector, SSE and router gaps. |
| `docs/harness-telemetria/diagnostico/A2-accounting-audit.md` | Audit of HIA and runtime telemetry JSONL: null vs zero, orphan schema, gaps against accounting rules. |
| `docs/harness-telemetria/diagnostico/A3-office-concurrency.md` | Reproduction of the per-engine overwrite bug in the office and the coupling assessment. |
| `docs/harness-telemetria/diagnostico/A4-dispatch-paths.md` | Spawn, workflow, skill, approval and cancel paths with ids and ranked instrumentation points. |
| `docs/harness-telemetria/diagnostico/A5-engine-capability-matrix.md` | Capability matrix for Claude Code, Codex, Gemini and OpenCode with sources and the recommended first adapter. |
| `tests/office-agent-concurrency.test.js` | Office bridge regression tests: per-engine active count, error masking, reset notice, compare mode (same-document only). |
| `docs/harness-telemetria/adr/README.md` | Index of the telemetry ADRs (proposed, awaiting user review), their dependencies and open items. |
| `docs/harness-telemetria/adr/ADR-TEL-001-store.md` | Extend the EP-09 SQLite log; usage lives in the same DB under a separate retention class. |
| `docs/harness-telemetria/adr/ADR-TEL-002-ingestion-order.md` | Ingestion order: in-process bridges, engine adapters, optional OTLP/HTTP receiver; transcripts first. |
| `docs/harness-telemetria/adr/ADR-TEL-003-correlation.md` | runId minted before spawn, scoped native ids, relation grade native/declared/inferred/unknown. |
| `docs/harness-telemetria/adr/ADR-TEL-004-dedup-idempotency.md` | idempotencyKey per event, callId per model call, streaming upsert. |
| `docs/harness-telemetria/adr/ADR-TEL-005-state-projection.md` | Rebuildable projections; presence, activity and phase kept separate; ordering by occurrence time. |
| `docs/harness-telemetria/adr/ADR-TEL-006-accounting.md` | usage.observed per call, null vs zero, cost kinds, legacy import quality. |
| `docs/harness-telemetria/adr/ADR-TEL-007-privacy.md` | Metadata-only default, opt-in text, sanitization at ingest, read-endpoint access. |

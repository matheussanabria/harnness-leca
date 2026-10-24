# Telemetry program: ADR index

Status of this set: proposed, awaiting user review. Nothing here is implemented or accepted. Gate: user review before T1.2 starts (plan section 11).

Source of truth: `docs/harness-telemetria/00-plano-consolidado.md` sections 2, 3, 5. Diagnostics: `docs/harness-telemetria/diagnostico/A1..A5`.

Convention: one file per ADR, frontmatter and sections as in `docs/harness-evolution/_templates/adr-template.md` (Context, Decision, Alternatives considered, Consequences), plus Verification and Evidence references. Ids `ADR-TEL-00N` map to plan items `T0N`. Evidence labels: verified (read in code), reproduced, documented (external or project docs), assumption.

| ADR | Plan | Title | Status |
|---|---|---|---|
| [ADR-TEL-001](ADR-TEL-001-store.md) | T01 | Extend the EP-09 SQLite log; usage in the same DB with separate retention | proposed |
| [ADR-TEL-002](ADR-TEL-002-ingestion-order.md) | T02 | Ingestion order: bridges, engine adapters, optional OTLP/HTTP receiver, transcripts first | proposed |
| [ADR-TEL-003](ADR-TEL-003-correlation.md) | T03 | runId minted before spawn, scoped native ids, relation grading | proposed |
| [ADR-TEL-004](ADR-TEL-004-dedup-idempotency.md) | T04 | idempotencyKey per event, callId per model call, streaming upsert | proposed |
| [ADR-TEL-005](ADR-TEL-005-state-projection.md) | T05 | Rebuildable projections, separate presence/activity/phase, ordering by occurrence time | proposed |
| [ADR-TEL-006](ADR-TEL-006-accounting.md) | T06 | usage.observed per call, null vs zero, semantics, cost kinds, legacy quality | proposed |
| [ADR-TEL-007](ADR-TEL-007-privacy.md) | T07 | Metadata only by default, text behind a flag, sanitization at ingest | proposed |

Dependencies: 001 is the base. 004 and 006 depend on each other for call-level rules. 007 is enforced in the single ingest path defined by 002. 005 depends on 003 and 004 for run and attempt identity.

Open items carried from the diagnostics (not decided here): git-ignore status of `events.sqlite`; stale-activity TTL value; Antigravity capability study A6; Codex `[otel]` shape on 0.146 alpha; OpenCode `/doc` usage fields; price table owner.

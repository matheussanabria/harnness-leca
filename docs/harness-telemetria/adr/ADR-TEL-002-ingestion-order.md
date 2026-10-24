---
id: ADR-TEL-002
titulo: "Ingestion order: in-process bridges, engine adapters, optional OTLP receiver"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T02, T2.1, T2.2, T3.1, T3.4, T3.6]
tags: [harness-telemetria, adr]
---

# ADR-TEL-002: Ingestion order

Evidence labels: verified, documented, assumption.

## Context

- Only two callers of `publish()` exist: the loopback `POST .../events` controller and `session.discovered` (A4 section 0 item 1; `central-events.controller.js:109`, `session-registry-orchestrator.service.js:23`). Verified.
- `emitWorkflowEvent` (`workflow-events.js:8`) is one choke point for all workflow, stage, approval, cancel and routine events, today going to the in-memory engine only (A4 section 2, section 6 item 1). Verified.
- `POST /api/chat` is the choke point for all chat engines and publishes nothing (`chat.controller.js:72-129`, A4 section 1.1; A3 F6). Verified.
- Cloud engine tokens are captured nowhere; the Claude stream parser reads only `is_error`, `result`, `subtype`, `api_error_status` and ignores `tool_use` (A2 section 7; `claude.js:177-188`; A4 section 3.5). Verified.
- Engine capabilities (A5 section 2, 6): Claude Code documents OTLP with tokens, cost, subagent ids and skill name, and writes local transcripts with `message.usage`; Codex rollout JSONL carries `token_count` incl. reasoning; OpenCode exposes a REST/SSE API whose usage fields are not documented; the Gemini CLI is dropped and the Antigravity CLI needs study A6. Documented, plus locally observed structure for transcripts and rollouts.
- No telemetry env or config is set anywhere; all engine collection is opt-in (A5 section 1). Verified.
- A local OTLP receiver means a new network listener and ingest path; user decision 10.1: transcripts first, optional receiver later (plan section 10).

## Decision

Order of ingestion paths, each usable without the next:

1. In-process bridges (no new process): `emitWorkflowEvent` also calls EP-09 `publish` (T2.1); chat run lifecycle events from `chat.controller.js` including rejected (429), finished, errored, and distinct stop vs disconnect (T2.2); then `permissions.js settle()` and the context-injection point. The in-memory feed is retired after the office consumes the projection (user decision 10.3).
2. Engine adapters reading local evidence, read-only and best-effort, each behind a version gate: Claude transcripts (`message.usage`, subagent index) first; Codex rollout files second (reuse `codex-bin.js` resolution); OpenCode via REST/SSE after reading its `/doc` spec (post-MVP); Antigravity after study A6.
3. Optional local OTLP/HTTP receiver, off by default, loopback-bound, authenticated, with size and rate limits, added after transcripts and enabled per run by env injection at spawn (`claude.js` per-run env). It posts into the same ingest path as every other source; it is not a separate store.
4. Every path converges on one ingest function that applies the allowlist, sanitizer and idempotency (ADR-TEL-004, ADR-TEL-007). Adapters never write to SQLite directly.

Adapter output declares coverage per field (which fields the engine can supply), so missing data is visible as coverage, not as zero.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| OTLP receiver first | Documented, real-time, includes cost for Claude | New listener and daemon surface before the contract and sanitizer exist; user decision is transcripts first; harness spawns Claude in stdin stream-json mode where inbound `TRACEPARENT` may be ignored (A5 section 3, unverified) |
| Standalone OTel collector as a sidecar | Mature, multi-signal | Extra process, RAM and operations; plan requires measured resource budget; new dependency to vet |
| Parse the live stream only (no transcripts) | Real time, no file reads | Stream parser carries no usage today and block shapes are unverified (A4 section 7 item 4); loses resumed or externally started sessions |
| Rely on LLM self-report (agent declares skills and usage) | Zero engineering | Not evidence; violates the goal of non-self-reported instrumentation (A4 section 3.5) |
| One permanent adapter agent per engine | Isolation | Plan section 7 forbids permanent agents per engine (RAM budget) |

## Consequences

- Easier: first value (workflow, chat lifecycle, Claude usage) without any new daemon; each adapter is independently shippable and testable with sanitized fixtures.
- Harder: transcript formats are undocumented and may change (A5 section 4); adapters need version gates and read-time field dropping. Real-time latency of transcripts is bounded by file writes, not push.
- Cost fields: Claude OTLP supplies cost, transcripts do not; cost from transcripts is `estimated` via the price table (T3.3, ADR-TEL-006).
- Skill and subagent evidence is Claude-only at first; other engines report `unknown`, never zero.
- The receiver, when added, needs a security review (T3.1, `security-engineer`).

## Verification

- Bridge tests: a workflow start, stage advance, approval and cancel each produce the expected EP-09 event (T2.1 acceptance).
- Adapter contract tests with sanitized fixtures per engine and version, including a fixture with missing `usage` asserting null output.
- Coverage test: an adapter that cannot supply a field emits null and a coverage flag, never 0.
- Receiver (when built): off by default test, non-loopback bind rejected, oversize body rejected, same ingest path as other sources.
- Open runtime checks before building (A5 section 5): Claude `OTEL_*` under stdin mode and whether `session.id` equals the stored resume id; Codex `[otel]` shape on 0.146 alpha; OpenCode `/doc`.

## Evidence references

- A4 section 0, 1.1, 2, 3.5, 6 (`workflow-events.js:8`, `chat.controller.js:72-129`, `claude.js:140-190`) - verified.
- A2 section 7 (`claude.js:177-188`) - verified.
- A5 section 2.1, 2.2, 2.4, 3, 6 - documented (OTLP fields, Codex `[otel]`, OpenCode endpoints) and observed locally (transcript and rollout structure).
- Claude block shapes for `Skill`/`Task` tool_use, Codex `-c otel.*` override, OpenCode usage fields - assumption, to be verified.

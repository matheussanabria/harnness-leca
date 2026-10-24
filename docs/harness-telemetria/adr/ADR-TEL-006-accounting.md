---
id: ADR-TEL-006
titulo: "Accounting: per-call usage events, null vs zero, observation semantics, cost kinds"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T06, T1.2, T1.4, T3.1, T3.3, T3.4, T4.1]
tags: [harness-telemetria, adr]
---

# ADR-TEL-006: Accounting

Evidence labels: verified, documented, assumption.

## Context

- Absent numbers become 0 in the writer, client and readers: `runtime/telemetry.js:51-56`, `ollama-client.js:258-263`, readers `rec.tokensSaved || 0`, `item.tokensPrompt || 0` (`hia/telemetry.js:68`, `runtime/telemetry.js:100-102`). 217 of 386 runtime lines carry zeros that mean "not measured"; `avgDurationMs` is biased down (A2 section 2.2, 4). Verified.
- Dispatcher hard-codes tokens 0 for `local_llm` although the stream result is never read; tokens are unavailable, not zero (`dispatcher.service.js:73-76,140-143`) (A2 section 4). Verified.
- All 275 `hia-executions` lines are `script/succeeded` with tokens 0 and look like test-run pollution because tests do not set `HARNESS_ROOT` (`root.js:6-8`) (A2 section 2.1, 8). Mechanism verified; attribution of lines is an assumption.
- `schemas/hia-execution.schema.json` has token fields and `metricSource` (`reported|estimated|unavailable`) but tokens are not nullable, there is no cost, currency or price-table version, and no code validates against it; every real line would fail it (A2 section 2.3, 3). Verified.
- Cloud engine tokens and cost are not captured anywhere; only the local Ollama classifier has tokens (A2 section 7). Verified.
- Claude documents `api_request` events with input, output, cache read, cache creation tokens and `cost_usd`; reasoning tokens have no separate field; transcripts carry `message.usage` without cost (A5 section 2.1). Documented plus observed. Codex rollout `token_count` includes `reasoning_output_tokens` and `total_tokens`; no cost (A5 section 2.2). Observed. Gemini/Antigravity and OpenCode usage fields are unknown (A5 section 2.3, 2.4).
- Whether reasoning tokens are already inside output tokens differs by provider; double counting is a stated risk (A2 section 9 rule 4). Assumption per provider until a fixture proves it.
- Skill association: a call can serve two skills; A4 proposes skill evidence only from tool_use capture (A4 section 3.5, 6 item 4). Plan: skill links are separate events with no cost.
- User decision 10.2: subscription usage in scope; cost stays `estimated` and labelled API-equivalent; `billed` only with a billing source.

## Decision

1. Usage is its own event type `usage.observed`, one per observation of a model call, never nested in session or workflow events. Payload: `{ callId, provider, model, tokens{input, output, cacheRead, cacheCreation, reasoning}, cost{amount, currency, kind, priceTableVersion}, semantics, quality }`.
2. Absent is `null`; zero requires a valid observation that reported zero. Writers, importers and readers never coerce null to 0. Aggregations carry a coverage count (calls with a value over calls total) beside every sum. A sum over no observations is null, not 0.
3. `semantics` is one of `delta`, `cumulative`, `final`. Rollups count unique `callId` using the rules in ADR-TEL-004: final supersedes cumulative supersedes delta within a call. Cache and reasoning tokens are stored as the provider reports them; a per-provider mapping table (versioned) states whether `reasoning` is included in `output`, and the rollup never adds both when it is included.
4. `cost.kind` is one of `estimated`, `reported`, `billed`, or null. `reported` is a value the engine itself emitted (for example Claude `cost_usd`). `estimated` is tokens times a versioned price table (T3.3), labelled API-equivalent for subscription usage. `billed` exists only with an actual billing source. `cost` is null when unknown, never 0. `priceTableVersion` and currency are mandatory when an amount is present.
5. `quality` records provenance: `native` (engine event or transcript field), `derived`, `unknown`. Legacy imports are `quality=unknown` and `origin=legacy`; their zeros are imported as null where the writer path coerced absence (runtime failure lines, dispatcher `local_llm`), and as 0 only for `script` executions where zero is plausible and flagged as unverified.
6. Skill association is a separate `skill.applied` event referencing `callId`s with its own `relation` grade; it carries no tokens or cost. Two skills on one call yield one cost. Per-skill cost views are allocations, labelled as such, never added to the total.
7. Parent runs never carry their children's usage; hierarchy totals are computed by traversal over unique `callId`.
8. The legacy `hia-execution.schema.json` is superseded for usage by this event contract; token fields in the schema are made nullable only if the schema is kept, decided in T1.2.
9. Tokens saved by routing (`tokensSaved`) are an estimate with a method field, kept separate from observed usage.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Extend `hia-execution.schema.json` and migrate both writers | Reuses an existing contract | No call id, no cost, tokens non-nullable, status enum mismatch; one record per execution, not per call (A2 section 3) |
| Nest usage in `session` or `workflow` events | Fewer event types | Double counting between parent and child, no per-call granularity, cannot replay a call |
| Zero as default for missing (current) | Simple dashboards | Indistinguishable from true zero; understates coverage; verified wrong |
| Store one running total per session | Compact | Resets, resends and re-imports corrupt it; cannot attribute to calls or skills |
| Allocate cost to skills additively | Per-skill cost view | Multiple skills per call inflate total; allocation view is permitted but not additive |
| Fetch billed cost from provider billing APIs now | True cost | No billing source documented here; out of scope; `billed` stays reserved |
| Discard legacy logs | Clean data | User decision 2: preserve and import; nothing deleted without confirmation |

## Consequences

- Easier: honest dashboards (coverage, estimated vs reported), reproducible totals, safe replays, mixed engines in one view.
- Harder: every consumer must handle null and coverage; the price table needs an owner and versioning (T3.3); per-provider reasoning/cache mapping must be maintained and version-gated (A5 section 4).
- Legacy numbers are low quality; dashboards must show them separately or filtered by quality.
- Cost for Codex, OpenCode and Antigravity depends on a price table and open questions (A5 section 7 item 7); until then their cost is null.
- Test hygiene (T0.2) is a precondition for trusting any baseline.

## Verification

- Null-vs-zero tests: writer, importer and reader keep null; a sum with partial coverage reports its coverage.
- Streaming-then-final test (shared with ADR-TEL-004) and a no-double-count test for reasoning tokens per provider fixture.
- Two skills on one call: one cost in the total, two `skill.applied` links, no cost on the links (T4.1 acceptance).
- Cost labelling test: estimated cost without `priceTableVersion` is rejected at ingest.
- Legacy importer fixture: runtime failure lines import as null tokens; `origin=legacy`, `quality=unknown`.
- Compare Claude `reported` cost against an estimate from the same call to validate the price table (T3.3), when both exist.

## Evidence references

- A2 section 2-4, 7, 8, 9 (`runtime/telemetry.js:51-56,100-102`, `hia/telemetry.js:68`, `ollama-client.js:258-263`, `dispatcher.service.js:73-76,140-143`, `hia-execution.schema.json:41-58`) - verified.
- A5 section 2.1, 2.2 (Claude usage and cost fields, Codex `token_count`) - documented and observed locally.
- A4 section 3.5 - verified for parser scope; stream-json block shapes - assumption.
- Reasoning-in-output mapping per provider, test-pollution attribution of the 273 lines - assumption.

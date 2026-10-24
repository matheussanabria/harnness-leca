---
id: ADR-TEL-003
titulo: "Correlation: runId minted before spawn, scoped native ids, relation grading"
status: proposta   # proposed, awaiting user review
data: 2026-10-24
historias: [T03, T1.2, T2.2, T3.1, T4.1]
tags: [harness-telemetria, adr]
---

# ADR-TEL-003: Correlation

Evidence labels: verified, documented, assumption.

## Context

- Spawns carry no identity: `chatId = crypto.randomUUID()` exists per request (`chat.controller.js:110`) but is used only for permission cards and the shadow correlation id (A4 section 0 item 2). Verified.
- Identity vocabularies collide: chat `chatId`, engine `sessionId` (engine-owned, can change on resume or re-create, e.g. OpenCode `opencode.js:85`), canonical `session.id` fingerprint `provider|nativeSessionId|sourceKind` (`session-model.js:20-24`), workflow `executionId = wf-<uuid>` (`workflow-runner.service.js:56`), HIA `exec-<Date.now()>` (not collision safe, `dispatcher:68,135`) (A4 section 7 item 2; A2 section 6). Verified.
- The Ollama engine uses a fixed `sessionId: "ollama-local"` (`ollama.js:94,97`), so sessions are indistinguishable (A4 section 1.7). Verified.
- No `hostId` or `engineInstanceId` exists, so two hosts or two OpenCode instances with equal native ids collide in the fingerprint (A1 section 4). Verified in code, practical occurrence assumption.
- The workflow runner never launches an engine and has no field linking a stage to a session or agent (A4 section 2.7; `workflow-runner.service.js:55-80`). Verified.
- Claude documents `agent_id`, `parent_agent_id`, `session.id` (changes on `/clear`) and resource attributes via `OTEL_RESOURCE_ATTRIBUTES` (A5 section 2.1, 3). Documented. Inbound `TRACEPARENT` is honoured only in `-p`/SDK mode, not in the current stdin stream-json mode (A5 section 2.1). Documented; whether the repo mode counts is unverified.
- EP-09 and EP-08.04 name the same concept differently (`correlationId`, `parentExecutionId` vs proposed `traceId`, `parentRunId`) (A1 section 3 P1). Verified.

## Decision

1. The harness mints `runId` before it spawns or calls any engine, and passes it through the channel the engine supports (Claude: per-run env and `OTEL_RESOURCE_ATTRIBUTES`; Codex: `-c` args where verified; OpenCode and Gemini/Antigravity: session title or id, no env path). For chat, `runId` equals `chatId` (plan T2.2). For workflows, a run is a child of the `workflowRunId`.
2. Native ids are stored verbatim and scoped: `engineInstanceId` (engine + host + instance) plus `nativeSessionId`. Scope is never dropped, never used alone as a key. The Ollama fixed id is overridden with the `runId`.
3. Relations are graded in `relation`:
   - `native`: the engine itself reported the link (for example `parent_agent_id`, rollout `sub_agent_activity`).
   - `declared`: the harness set the link at spawn (the minted `runId`, a declared parent).
   - `inferred`: derived by time, path or heuristics.
   - `unknown`: the default; nothing is proven.
   Unproven links stay `inferred` or `unknown`, never promoted. Aggregations that need strong attribution filter on `native` or `declared`.
4. Vocabulary: keep EP-09 names and add `runId`, `parentRunId`, `traceId`; map EP-08.04 `correlationId`, `parentExecutionId`, `executionId` onto them in the bridge (plan section 3 mapping table). No third naming.
5. Workflow stage to run link is explicit: `advanceWorkflowRun` accepts optional `sessionId`/`runId`/`agentId`, recorded in the `task.*` payload (T4.1).
6. An attempt or retry is its own `attemptId`, minted by the harness.

## Alternatives considered

| Alternative | Pros | Why rejected |
|---|---|---|
| Use the engine native session id as the primary key | No minting step | Native ids change on resume, `/clear`, or re-create, collide across hosts, and do not exist before spawn |
| Reuse the canonical fingerprint as the run key | Already implemented | Identifies a session, not a run; lacks instance scope; one session holds many runs |
| W3C `traceparent` as the only correlation | Standard | Claude ignores inbound `TRACEPARENT` in the current stdin mode; other engines do not document it (A5) |
| Infer parent-child from timing and cwd | Works for every engine | Wrong links look authoritative and corrupt aggregates; kept only as `inferred` |
| Switch Claude to `-p`/SDK mode to get trace propagation | Real propagation | Changes the interactive control model; needs separate decision; deferred |

## Consequences

- Easier: every event can join to a run; native ids remain debuggable; unknown is visible instead of guessed.
- Harder: spawn sites must be touched to mint and pass the id (T2.2, T3.1); the envelope gains several nullable fields; consumers must handle `relation` filtering.
- Fingerprint change: adding instance scope to session identity needs a reconciler migration for `canonical-sessions.json` (assumption on effort; not sized).
- Engines with no injection path (OpenCode, Gemini) get correlation by session title or id only, graded `declared` or `inferred` accordingly.

## Verification

- Two chats on the same engine produce distinct `runId`s and independent projections (T2.2 acceptance).
- A fixture with equal `nativeSessionId` on two `engineInstanceId`s stays two sessions.
- A run with no provable parent stores `relation=unknown` and null `parentRunId`; a test asserts it is excluded from `native`-only rollups.
- Claude run under stdin mode: capture whether `session.id` in telemetry equals the id parsed from the stream (`claude.js:156`); record the result in A5.

## Evidence references

- A4 `chat.controller.js:110`, `ollama.js:94,97`, `opencode.js:85`, `workflow-runner.service.js:55-80` - verified.
- A1 `session-model.js:20-24` - verified.
- A2 `dispatcher:68,135` - verified.
- A5 section 2.1 (`agent_id`, `parent_agent_id`, `TRACEPARENT` limits) - documented.
- Instance collision in practice, effort of fingerprint migration - assumption.

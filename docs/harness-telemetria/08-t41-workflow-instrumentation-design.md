# T4.1 design: instrument one real workflow end to end

Status: design proposal, 2026-10-24. No code changed. Baseline: branch `docs/t41-workflow-design` (includes T1.2, T2.1, T2.2, T3.1 pricing and usage ingest).
Labels: [V] verified in code (static reading, nothing executed), [D] documented (repo docs or external docs), [A] assumption to confirm.
Inputs: plan sections 3 and 6, pre-plan sections 7 and 8, ADR-TEL-003/004/005/006/007, diagnostic A4, EP-08.04/08.05/08.06 stories.

## 1. Chosen candidate and why

Finding: no code in the repo launches an engine for a workflow stage [V]. `advanceWorkflowRun` is called only by `orchestration-workflow-runs.controller.js` (loopback HTTP) and tests (grep over the repo). The EP-08.04 runner is a ledger: someone else does the work and reports stage status. EP-08.06 (in-flight, `C:/Temp/hl-ep08`) adds a UI whose Advance button posts `{status: "completed"}` by default [V: `design-workflows-api.js:64-68`], so a click completes a stage with no agent evidence.

| Candidate | Launches engine? | Steps | Skills visible? | Usage visible? | Verdict |
|---|---|---|---|---|---|
| EP-08 `hotfix` workflow (6 stages, 2 approval gates: `commit-pr`, `deploy`) [V: `workflow-definitions.js:13,11`] with each stage worked in a Claude chat run | Yes, via `POST /api/chat` -> `streamClaude` [V] | Real, with approvals and blocked/failed states | Yes: stream parser sees tool_use (once captured); expected skills per stage in the plan [V: 08.06 section 2] | Yes: transcript ingest gives per-call usage with `sessionId` and `at` [V: `call-normalizer.js:93-117`] | Chosen |
| Legacy routine `prompt` / `sync-extrair` (`tools/lib/routines.js:169-198`) | Yes, `llm.ask` -> `spawnSync claude --tools "" --no-session-persistence` [V per A4 1.9] | 1-2 script calls | No (no tools) | No transcript is persisted | Rejected: cannot show skills or per-call usage |
| `opencode-package runPackage` (`tools/lib/opencode-package/run.js:40`) | Yes, `spawnSync opencode run` | One run per story | No signal parsed | No usage fields (A5) | Rejected: one step, no skill or usage evidence |
| Coordination ledger (`tools/lib/coordination/service.js:100 mutate`) | No, ledger of claims and handoffs | Story states | No | No | Later bridge (A4 1.18), not T4.1 |

Why `hotfix` over `feature-delivery`: fewer stages (6), covers `dev`, `tests`, `review` (agent work) and two human gates, so wall time, agent time and approval wait all appear in one small run. `feature-delivery` is the same code path and follows for free.

Trade-off accepted: the stage-to-run link is made by the harness at chat start (server-validated), not discovered. Runs executed outside the harness chat (terminal Claude Code calling `advance`) stay `declared` or `unknown` (section 4).

## 2. Entity and id model

| Concept | Id | Minted by / when | Existing field [V] | New |
|---|---|---|---|---|
| Workflow run | `workflowRunId` = `executionId` (`wf-<uuid>`) | runner at start, `workflow-runner.service.js:56` | envelope `workflowRunId`, `executionId`, `runId` set by `toIngestBody` (`workflow-event-bridge.js:64-66`) | none |
| Step run | `stepRunId` = `<executionId>:stage:<stageId>` | derived by bridge from `taskId` (`:71`) | envelope `stepRunId` | none |
| Attempt | `attemptId` = `att-<uuid>`, plus `attemptNo` (payload) | runner, when a step is started/restarted (new, section 3) | envelope column `attempt_id` exists (`event-envelope.js:21`), never written yet | minting + lift from payload |
| Engine run | `runId` = `chatId` (uuid) | `chat.controller.js:114`, before spawn; tracker takes it (`:120`) | envelope `runId`, `executionId` in `chat-run-telemetry.service.js:99-105` | add `workflowRunId`, `stepRunId`, `attemptId`, `parentRunId` |
| Native session | `nativeSessionId` + `engineInstanceId` `claude@<host>` | stream `d.session_id` (`claude.js:156`), set by tracker `observe` | envelope columns, `session.updated` native (`:122-126`) | none |
| Model call | `callId` = Claude `message.id` | transcript ingest | `usage.observed.payload.callId`, idempotency `usage|claude|<callId>` [V] | none |
| Subagent | `agentId` (sidechain only) | transcript | `usage.observed` envelope `agentId` [V] | none |

Hierarchy: workflowRun 1-N stepRun 1-N attempt 1-N engine run (a multi-turn conversation in one step is several runs in one attempt) 1-N call. Rule: an engine run points to its parent with `parentRunId = workflowRunId`, `relation=declared` (ADR-TEL-003 item 1).

Attempt definition (proposal): one try at a step. A new attempt opens on `task.started` when the step has no open attempt (first start, or restart after `blocked`). Whether a `failed` step may be retried is an open question (Q1) because the runner today ends the run on `failed` [V: `workflow-runner.service.js:182-191`].

## 3. Events: reuse first, additions listed

Allowlist today [V: `event-type-allowlist.js`]: EP-09 types, EP-08.04 catalog (`execution.*`, `task.*`, `tool.*`, `artifact.created`), `usage.observed`, `skill.discovered|loaded|applied`, `run.started|finished`. No new type is required.

| Fact | Event (existing type) | Producer | Change |
|---|---|---|---|
| Workflow start/end/cancel | `execution.started/completed/failed/cancelled` | runner via bridge | none |
| Step created/started/progressed/blocked/completed/failed | `task.*` with `taskId stage:<id>` | runner | add `attemptId`, `attemptNo`, optional `sessionId`/`runId` to payload |
| Approval requested/decided | `execution.approval_requested/approved/rejected` | runner, approval service | none (timestamps give wait time) |
| Engine run for a step | `run.started`, `run.finished`, `execution.*` (chat tracker) | `chat-run-telemetry.service.js` | add `workflowRunId`, `stepRunId`, `attemptId`, `parentRunId` to the envelope when a validated link is supplied |
| Skill loaded | `skill.loaded` | Claude stream parser | new producer; payload `{skillName, toolUseId, callId, resultOk, evidence: "tool_use"}` |
| Subagent started | `tool.invoked` | Claude stream parser | new producer; payload `{toolName: "Task", subagentType, toolUseId, callId}` |
| Usage | `usage.observed` | transcript ingestor | none (joined at read time, section 6) |
| Validation | `task.completed` payload `validation: {status: "not_evaluated" or "passed" or "failed", criterionId, evidenceRef}` | runner | optional field, additive |

Additions to existing code: (a) the bridge lifts `payload.attemptId` to the envelope `attemptId` (single file, `workflow-event-bridge.js:54-76`, avoids touching `event-contract.js`); (b) idempotency keys for repeatable types already include the timestamp (`:44-48`), attempt events add `attemptId` to the key [A: needed only if two attempts can share a timestamp]; (c) payload field names must avoid the sanitizer secret/text keys (`*token`, `content`, `text`, `arguments`, `tool_input`) [V: `event-sanitizer.js:17-21`]. `skill.applied` is not emitted in T4.1 (see section 5); plan T4.1 acceptance "two skills on one call = one cost" is met with two `skill.loaded` rows sharing one `callId`. Flagged as Q4.

## 4. Linking an engine run to a step

1. New `workflow-attempt.service.js` (runner side): `openAttempt(executionId, stageId)` returns `{attemptId, attemptNo}`; closes on `completed|failed|blocked|cancelled`. Exposed by `POST /api/orchestration/workflow-runs/:id/attempts` (loopback only, like `advance`) and called implicitly by `advance` with `status=started`.
2. The client sends `workflow: {executionId, stageId, attemptId}` in the `POST /api/chat` body (optional, ignored by older clients). The server validates against the runner store: run exists, slug equal to the chat slug, run `running`, stage is current, attempt open [V: run object holds `stageState`, `currentIndex`, `status`]. Invalid or stale: chat proceeds unlinked, a counter increments, nothing breaks (fail secure; never trust client ids, security-by-default).
3. `chat.controller.js` passes the validated ids to `createChatRunTracker` (new optional params); the tracker stamps them on every event of that run. `runId` is still minted by the controller before spawn (ADR-TEL-003 item 1); no env or `--resume` argument is needed for Claude.
4. External agents (Claude Code in a terminal) call `advance` with optional `sessionId`; stored as `declared` and upgraded to `inferred` only if a `usage.observed` with that `nativeSessionId` falls in the step window. Never `native`.
5. Known gap [V]: the tracker keeps the first `nativeSessionId` only (`:120`), so if the client resumed with id X and Claude reports another `session_id` Y in the stream, usage under Y would not join. Whether `--resume` keeps the id is unverified [A]; first spike of T4.1a (Q2).

## 5. Skill evidence from the stream parser (Claude only)

Today `createClaudeStreamParser` handles only `text`, `thinking` and `result` blocks [V: `claude.js:159-187`]; the unit test uses a bare `{type:"tool_use"}` [V: `tests/engines.test.js:42`]. Transcript tools elsewhere read `block.name`, `block.id`, `block.input` [V: `claude-adapter.js:121-135`, `tests/helpers/fixtures.js:29`], so the generic tool_use shape is established, the Skill and Task specifics are not.

Design: add an optional `onToolUse({id, name, input-derived metadata, messageId})` callback to the parser; it never changes the existing `onChunk` SSE contract. Dedup by `block.id` (streaming repeats a message per block, [V] `usage-config.js` header). For `name == "Skill"` extract only the skill name; for `name == "Task"` only `subagent_type`. Drop all other input fields at the parser (privacy, ADR-TEL-007). `messageId` = `d.message.id`, which equals the usage `callId` [A: transcript and stream share `message.id`; confirm with one captured run].

| Statement | Status |
|---|---|
| The model emitted a tool_use block named Skill with skill X in message M | Verified by the harness from the live stream (shape [A] until a fixture is captured) |
| The skill content was delivered | Verified only if the matching `tool_result` (same `tool_use_id`) arrives without `is_error`; otherwise `resultOk: null` |
| The skill instructions were followed, or the outcome improved | Unknown. Never inferred, never taken from model self-report |
| A subagent ran and its usage | Verified from transcript sidechain lines (`agentId`, parent `sessionId`) [V]; link of a Task block to a specific `agentId` is [A] |
| Skills the Claude CLI loads without a tool_use (auto-discovery, system prompt) | Unknown (A4 3.4) |
| Codex, OpenCode, Antigravity, Ollama | Unknown: no equivalent signal parsed [V]; reported as `coverage: claude-only` |

Expected vs observed: expected skills per stage come from the plan (`skills[{name, available, bound}]`, [V] 08.06); the view shows expected-and-observed, expected-not-observed, observed-not-expected. "Not observed" is not "not used" when the engine is not Claude.

## 6. Usage per step without double counting

1. Calls are unique by `callId` (idempotency key `usage|claude|<callId>` [V]); the log keeps one row per call, so joining never multiplies cost.
2. Attribution is a read-time join in the projection (log stays append-only, rebuildable, ADR-TEL-005): a call belongs to engine run R if `usage.nativeSessionId == R.nativeSessionId` and `R.startedAt <= usage.at <= R.finishedAt + grace` (grace default 5 s, configurable). `usage.at` is the call timestamp, not ingestion time [V: `call-normalizer.js:63`], so the ingest lag (30 s tick) does not matter.
3. Sidechain calls (`payload.sidechain=true`, `agentId` set) carry the parent session id [V] and fall in the same window: they count once under the run, flagged as subagent usage.
4. Overlapping windows on one session match more than one run: the call goes to `ambiguous`, excluded from step totals and reported separately. A call matching no window goes to `unattributed`. Relation of the attribution is `inferred`; it becomes `declared` only if a later story stamps `runId` on usage events.
5. Step totals = sum of unique attributed calls per attempt, with `coverage = attributed calls / all calls in the run windows` and null-never-zero (ADR-TEL-006). Cost stays `estimated`, API-equivalent, with `priceTableVersion` [V: `tools/lib/pricing`]. Skill links add no cost: two `skill.loaded` rows on one `callId` appear in the skill view, the call is in the total once.
6. A parent step never adds children runs on top; workflow total = sum over unique `callId` across its steps.

## 7. Metrics

Exposed by a new read model `GET /api/project/:slug/workflow-runs/:executionId/telemetry` (loopback, same access rule as the usage summary [A]) built from events by `workflow_run_id`, `step_run_id`, `attempt_id`.

| Metric | Definition | Source |
|---|---|---|
| `wallMs` | workflow end `at` minus start `at` | `execution.*` |
| `agentTimeSummedMs` | sum of `durationMs` of engine runs (may exceed wall time when runs overlap) | `run.finished.payload.durationMs` [V: tracker `:133`] |
| `agentTimeUnionMs` | union of run intervals (never above wall) | `run.started/finished` `at` |
| `approvalWaitMs` | approved/rejected `at` minus `approval_requested` `at`, per gate | [V] runner and approval service events |
| `idleMs` | wall minus union minus approval wait | derived, labelled "not attributed" |
| `attempts` | distinct `attemptId` per step | new |
| `outcome` | per step and run: `completed`, `failed`, `blocked`, `cancelled`, `rejected`, `running` | `task.*`, `execution.*` |
| `validated` | separate from `completed`: `passed` only with a criterion and an evidence reference; otherwise `completed_not_validated` | `task.completed.validation` |
| `usage` | tokens, estimated cost, coverage, ambiguous and unattributed counts | section 6 |
| `skills` | expected, observed, evidence level | section 5 |

Validated vs completed (pre-plan section 8): in T4.1 the only harness-verifiable evidence is a recorded human approval on gated stages (`execution.approved`, [V]) and an externally supplied reference such as a test run id. Ungated stages stay `completed_not_validated` unless a caller supplies evidence. The harness never decides "validated" from model text.

## 8. Privacy

- Metadata only: ids, names of skills/subagent types, counts, timestamps, token numbers [D ADR-TEL-007]. The parser drops Skill/Task inputs except the name fields.
- Exposure to check [V]: the workflow `note` (up to 500 chars, free text typed by an operator) is passed verbatim by the bridge into the payload (`workflow-runner.service.js:156`, `workflow-event-bridge.js:74`). Proposed: keep `noteLength` and drop the text from events (the JSONL history keeps the note). Q5.
- `stageId`, `executionId`, `routineId`, `actor` are already stored; `actor` is a free label (<=80 chars), no PII policy exists [A].
- Skill names are repo metadata; if a project skill name is sensitive, the existing text-capture flag does not cover it [A].

## 9. Failure and rollback

- Every new emitter follows the established pattern: catch, count, warn once, never throw into chat or runner [V: both bridges].
- Link validation failure means an unlinked run (`relation` stays as is, counter incremented); the chat is never blocked.
- Parser callback errors are isolated by try/catch inside the parser callback wrapper; a throw must not break SSE chunks.
- Flags (names proposed, [A]): `HARNESS_STEP_LINK=0` ignores the `workflow` body field; `HARNESS_TOOL_EVIDENCE=0` disables the parser callback. Existing precedent: `HARNESS_USAGE=0` [V].
- Rollback: all changes are additive (nullable envelope columns already exist; optional body/payload fields). Reverting a story leaves already-written events valid; projections ignore unknown fields. No data migration.
- Restart: runs live in server memory [D 08.06 section 9]; after a restart `attempts` and `advance` calls for old runs return 404, and chat links for them are rejected. Events already in SQLite remain readable; the projection must tolerate a run with no terminal event (`running` until a TTL, ADR-TEL-005 item 9).

## 10. Story breakdown

Sizes: S <= 0.5 day, M 1-2 days, L 3+ days; each with a range because nothing was executed.

| Story | Scope | Files to touch (all verified to exist) | Depends on | Acceptance | Tests | Size |
|---|---|---|---|---|---|---|
| T4.1a Capture spike and fixtures | Run one real Claude stream with a Skill and a Task call; record sanitized fixtures; check `--resume` session id and `message.id` equality with transcript `callId` | `tests/helpers/fixtures.js` (add fixtures); notes into this doc | none | Block shapes and the two [A] items in section 5 and 4.5 resolved | fixture-based | S (0.5-1 d; needs a real Claude run, ~ few cents API-equivalent) |
| T4.1b Parser tool_use capture | `onToolUse` callback, dedup by block id, name-only extraction, `skill.loaded` and `tool.invoked` publish via tracker | `tools/lib/engines/claude.js` (221 lines now; split a helper `claude-stream-parser.js` to stay under 300), `ui/server/services/chat-run-telemetry.service.js` (183 lines) | T4.1a, T2.2 (done) | Skill and Task blocks produce events with `callId`; SSE output unchanged; no input text stored | extend `tests/engines.test.js`, `tests/chat-run-telemetry.test.js` | M (1-2 d) |
| T4.1c Attempt model and bridge lift | `openAttempt`, `attemptId` in `task.*` payload, bridge lifts it, optional `validation` on `task.completed`, optional `sessionId` on advance | `ui/server/services/orchestration/workflow-runner.service.js` (245 lines; put attempts in a new `workflow-attempt.service.js`), `workflow-event-bridge.js`, `ui/server/controllers/orchestration-workflow-runs.controller.js`, `ui/server/routes/orchestration.routes.js` | T2.1 (done) | Attempt ids on step events; old callers unchanged; double `started` does not open two attempts | extend `tests/workflow-runner.test.js`, `tests/workflow-event-bridge.test.js`, `tests/workflow-http.test.js` | M (1-2 d) |
| T4.1d Engine run to step link | Accept and validate `workflow` in chat body, stamp ids on tracker events | `ui/server/controllers/chat.controller.js`, `chat-run-telemetry.service.js` | T4.1c | Valid link stamps run events; invalid/stale/foreign-slug link is ignored and counted | extend `tests/chat-run-telemetry.test.js` | S-M (0.5-1.5 d) |
| T4.1e Telemetry read model | Projection and endpoint with the metrics of section 7 and the join of section 6 | new `ui/server/services/workflow-telemetry/` (3 files <= 250 lines), `ui/server/routes/orchestration.routes.js`, new controller | T4.1c, T4.1d, T3.1 usage ingest (done) | Two skills on one call = one cost; ambiguous and unattributed reported; wall vs summed vs union differ in a parallel fixture; completed vs validated | new `tests/workflow-telemetry.test.js` (replay, out-of-order, null-vs-zero, coverage) | L (3-4 d) |
| T4.1f End-to-end acceptance | One scripted `hotfix` run with two chat runs, one approval, one blocked-then-restart | tests only | T4.1b-e | Chain workflow -> step -> attempt -> run -> session -> calls -> skills reproducible from the log alone | integration test with temp `HARNESS_ROOT` | M (1-2 d) |
| T4.1g UI hook (after EP-08.06 merges) | "Work this stage in chat" action passing the `workflow` body; metrics panel | `ui/public/js/modules/design-workflows*.js` (owned by EP-08.06 branch) | EP-08.06 merged, T4.1d, T4.1e | Manual browser check | fake-fetch tests | M, not in MVP |

Total backend T4.1a-f: about 7-11 days of one engineer, uncertainty mostly in T4.1a (real stream shape) and T4.1e (join edge cases). Order: a -> {b, c} in parallel (disjoint files) -> d -> e -> f.

Collision with EP-08.06 [V: `C:/Temp/hl-ep08/.../08.06-ui-workflows.md`]: that branch changes only `ui/public/**`, tests and mapa rows; it states no backend change. T4.1 touches only backend and tests, so no file overlap. Contract rule: `advance` keeps the body `{stageId, status, note}` with every new field optional, because the 08.06 client sends only those. The 08.06 Advance default (`completed`, no attempt) must yield `outcome=completed`, `link=none`, not an error. T4.1g must wait for that merge. Both branches add rows to different `docs/mapa/` files.

## 11. Open questions that really block

- Q1 (blocks T4.1c): may a `failed` step be retried in the same workflow run? Today it terminates the run. Without it, "attempts" only count blocked restarts and failed-then-retry needs a new run. Recommended default: allow `advance status=started` on a `failed` step only when the run has not been closed, which changes runner semantics and needs owner approval of EP-08.04.
- Q2 (blocks T4.1d join quality): does Claude keep the same `session_id` under `--resume`? If not, the tracker must append each new id (`session.updated`) instead of the first only. Resolved by T4.1a.
- Q3 (blocks T4.1b): real shape of the Skill and Task tool_use blocks and of their `tool_result` in `stream-json` for the installed version (2.1.301 per A5). Resolved by T4.1a.

Non-blocking, default proposed: Q4 `skill.applied` stays unused until outcome evidence exists (default: use `skill.loaded`); Q5 drop workflow `note` text from events (default: yes); Q6 grace window 5 s; Q7 should step runs executed outside the harness chat (terminal Claude Code) be in scope for MVP (default: no, declared only).

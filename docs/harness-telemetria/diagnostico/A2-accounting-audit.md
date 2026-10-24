# A2 - Token/cost accounting audit (read-only)

Commit audited: `41d6cd58940d58211a48a3231f11846dcb721920` (branch main; only untracked file was the pre-plan).
Labels: **[V]** verified-in-code/data, **[A]** assumption. Paths relative to repo root.

## 1. Inventory

| Item | Role | Size |
|---|---|---|
| `tools/lib/hia/telemetry.js` | writer `recordExecution`, reader `getTelemetryMetrics`, file `logs/telemetry/hia-executions.jsonl` | 83 lines |
| `tools/lib/runtime/telemetry.js` | writer `recordInference`, reader `getRuntimeTelemetryMetrics`, file `logs/telemetry/runtime-shadow.jsonl` | 138 lines |
| `schemas/hia-execution.schema.json` | "canonical" execution contract (draft-07) | 80 lines |
| `tools/lib/hia/executor.js` | runs registry tools with timeout; returns `durationMs`; does NOT write telemetry | 88 lines |
| `tools/lib/hia/guard.js` | `ExecutionQueue` (concurrency 1) and `LoopGuard`; no telemetry, no counters | 106 lines |
| `ui/server/controllers/hia.controller.js` | metrics endpoint: calls both readers (`:11`, `:15`) | 30 lines |

Producers: `ui/server/services/hia-chat-dispatcher.service.js:67,134` (recordExecution); `tools/lib/runtime/shadow.js:51,68` (recordInference), invoked from `ui/server/controllers/chat.controller.js:124`. Consumers: `hia.controller.js:11,15`, `ui/public/js/modules/hia-dashboard.js:24,31` (Node-side module despite its path). [V]

## 2. Record shapes

### 2.1 hia-executions.jsonl (`hia/telemetry.js:12-26,38-41`) [V]
`executionId, taskId?, executorType, executorId, status, durationMs, tokensPrompt, tokensCompletion, tokensTotal, tokensSaved, startedAt?, completedAt?, error?` plus `recordedAt` (ISO, added by writer). The writer spreads the caller object as-is (`...record`): no validation, no field allowlist, no defaults.

Observed data (key names and value types only): 275 lines, all with exactly `executionId, executorType, executorId, status, durationMs, tokensPrompt, tokensCompletion, tokensTotal, tokensSaved, recordedAt`. All 275 are `script/succeeded`; executorId `git.status` 273, `repo.check` 2. `tokensPrompt/Completion/Total` are numeric `0` in 275/275. No `taskId`, `startedAt`, `completedAt` ever present. [V]

### 2.2 runtime-shadow.jsonl (`runtime/telemetry.js:42-59`) [V]
`correlationId, slug?, model, valid, tipo?, complexidade?, executorSugerido?, modulo?, totalDurationMs, loadDurationMs, promptDurationMs, evalDurationMs, tokensPrompt, tokensGenerated, errors?, timestamp`. The writer builds an explicit allowlist (good: no prompt text stored).

Observed: 386 lines, all valid JSON, 386 distinct `correlationId`. 169 valid classifications have numeric tokens/total duration; `loadDurationMs`, `promptDurationMs`, `evalDurationMs` are `0` in all 386 lines (never populated, even for successes). 217 failure lines have `tokensPrompt=0`, `tokensGenerated=0`, `totalDurationMs=0`, plus `errors`. [V]

### 2.3 Schema `hia-execution.schema.json` [V]
Required: `id, taskId, engineUsed, status, startedAt` (`:7`). Engines enum `script, local_llm, claude, codex, gemini, opencode` (`:19`); status enum `pending, running, completed, failed, cancelled, quota_exhausted, loop_detected` (`:29`). `metrics` has `tokensInput, tokensOutput, tokensCacheRead, tokensCacheWrite, tokensReasoning`, `metricSource` enum `reported|estimated|unavailable` (`:41-58`), `attempts`, `cacheHit`. `modelUsed`, `completedAt`, `durationMs` are nullable (`:22,35,38`); token fields are NOT nullable (`type: number`, `:44-48`). No cost fields, currency, price-table version, correlation/parent/session id, or call index. `additionalProperties` is unset (extras allowed).

## 3. Contract overlap and incompatibility [V]

The schema is not used by code: `hia-execution.schema` is referenced only in `telemetry.js:3` (comment) and docs/chats. No validator runs on write or read.

| Concept | Schema | hia-executions.jsonl | runtime-shadow.jsonl |
|---|---|---|---|
| id | `id` (`^[a-z0-9-]+$`) | `executionId` (`exec-<Date.now()>`) | `correlationId` |
| task link | `taskId` required | absent | absent |
| engine | `engineUsed` | `executorType` | none (`model` only) |
| model | `modelUsed` | none (`executorId` = tool or model) | `model` |
| status | enum above | `"succeeded"` (not in enum) | boolean `valid` |
| timing | `startedAt`, `completedAt`, `durationMs` | `durationMs`, `recordedAt` | 4 `*DurationMs`, `timestamp` |
| input tokens | `metrics.tokensInput` | `tokensPrompt` | `tokensPrompt` |
| output tokens | `metrics.tokensOutput` | `tokensCompletion` | `tokensGenerated` |
| total/cache/reasoning | cache r/w, reasoning | `tokensTotal` only | none |
| provenance | `metricSource` | none | none |
| cost | none | none | none |

- Every real hia-executions record would fail the schema (missing `id, taskId, engineUsed, startedAt`; status `succeeded` not in enum). [V]
- The two JSONL files differ in timestamp name (`recordedAt` vs `timestamp`) and token names; they cannot be joined because hia-executions has no `correlationId`. [V]
- Double-count risk [A]: a Local-First chat can yield a hia-executions line (`dispatcher:134`, tokens hard-coded 0) and a shadow line (`correlationId = chatId`, model `qwen3.5:4b` default, `shadow.js:24`). They are different calls but nothing links or distinguishes them.

## 4. Absent numeric fields: null vs 0 [V]

- `runtime/telemetry.js:51-56`: any non-number becomes `0` (durations and tokens). The failure path (`shadow.js:68-76`) omits generated tokens and load/prompt/eval durations, so they are written as `0`. Observed: 217 failure lines carry zeros that mean "not measured". Violates rule 5.
- `runtime/ollama-client.js:258-263`: `result.prompt_eval_count || 0`, `result.eval_count || 0`, durations `? ... : 0`; a missing count and a measured zero are indistinguishable.
- `dispatcher.service.js:73-76,140-143`: tokens hard-coded `0` for script (plausibly true zero) and for `local_llm` (NOT a true zero: the Ollama stream result is never read, so tokens are unavailable). `tokensSaved: decision.estimatedTokensSaved` may be `undefined` (dropped on stringify) while `onDone` uses `|| 0` (`:64,132`).
- Readers coerce again: `rec.tokensSaved || 0` (`hia/telemetry.js:68`), `item.tokensPrompt || 0` etc. (`runtime/telemetry.js:100-102`).
- `avgDurationMs` divides by all lines including failures with duration 0 (`runtime/telemetry.js:116`), biasing the mean down.
- `tokensSaved` is an estimate stored without method/quality and summed as if measured. (Router method not audited: [A].)

## 5. Reading, volume and invalid lines [V]

| File | Bytes | Lines | Invalid JSON lines |
|---|---|---|---|
| `logs/telemetry/hia-executions.jsonl` | 65,181 | 275 | 0 |
| `logs/telemetry/runtime-shadow.jsonl` | 121,153 | 386 | 0 |

(`logs/telemetry` is git-ignored, confirmed with `git check-ignore`.) Both readers `readFileSync` the whole file, split, filter blanks and parse every line on every call (`hia/telemetry.js:59-60`, `runtime/telemetry.js:86-87`), i.e. on each metrics request and dashboard load. No size cap, rotation, offset, or cache. At about 237 B and 314 B per line, 100k lines would be roughly 24 MB and 31 MB re-parsed per request [A, extrapolation].

Invalid lines are swallowed by empty `catch {}` (`hia/telemetry.js:70`, `runtime/telemetry.js:107`): not counted, not reported. Yet totals use `lines.length` (`hia/telemetry.js:74`, `runtime/telemetry.js:111`) and `invalidInferences = lines.length - validCount` (`:113`), so a corrupt line is counted as an execution and as an "invalid inference". Line count and valid-record count are conflated. The runtime reader also returns an all-zero object on any read error (`:120-131`), masking failures as "no data". Integrity relies only on one `appendFileSync` per record; no lock, no schema version field.

## 6. Correlation ids [V]

- runtime-shadow: `correlationId = chatId` (`crypto.randomUUID()` per request, `chat.controller.js:110,124`); fallbacks `"shadow-" + Math.random()` (`shadow.js:23`) and literal `"unknown"` (`runtime/telemetry.js:43`). One request yields at most one shadow line.
- hia-executions: `executionId = exec-${Date.now()}` (`dispatcher:68,135`), millisecond-based and collision-prone under concurrency (current 275 are distinct, probably due to low rate [A]); not linked to `chatId`, `sessionId` (`sid` exists locally, `:44,99`), `slug` or `taskId`. No `slug` in these lines, so per-project aggregation is impossible.
- `ui/server/services/orchestration/event-contract.js:27,144` has an optional `correlationId` for a third (coordination event) contract; not wired to either telemetry file (contents otherwise not audited).
- `executor.js` and `guard.js` carry no ids; `LoopGuard` keys are 16-hex hashes local to the process. Schema status `loop_detected` has no producer.

## 7. Where tokens/cost of cloud engines are captured today [V]

**Nowhere in code.**
- Grep for `usage|input_tokens|output_tokens|total_cost|cache_read|modelUsage|num_turns|duration_ms` in `tools/lib/engines/*.js` yields only error regexes (`errors.js:31`) and request config `maxOutputTokens: 8192` (`gemini.js:53`).
- Claude: the stream parser handles `d.type === "result"` but reads only `is_error`, `result`, `subtype`, `api_error_status` (`claude.js:177-188`); any usage/cost on that event is dropped. `onDone({sessionId, fullText})` at `claude.js:80`. Whether the CLI emits usage there is [A], not verified.
- Codex `codex.js:58`, Gemini `gemini.js:33,109`, opencode `opencode.js:176`, Ollama engine `ollama.js:97,104`: `onDone` carries only `sessionId`/`fullText` (plus `thinking` for Gemini). No usage in any of the five.
- `tools/extract-artifacts.js`: no matches for tokens/usage/cost; it extracts artifacts from chat text. Its callers (`routines.js`, `sync-core.js`, `sync.js`) were not audited for accounting.
- The only measured token data: Ollama classifier path `runtime/ollama-client.js:258-263` feeding runtime-shadow. The Ollama chat engine (`engines/ollama.js`) does not forward counts. No cost, price table, currency, cache or reasoning data exists on any code path.

Consequence: dashboard "tokens" cover only the local classifier model; Claude/Codex/Gemini/opencode consumption is invisible.

## 8. Tests [V]

- `tests/hia-guard.test.js:34-52`: records one script execution; asserts `totalExecutions > 0` and `totalTokensSaved >= 1200`. Nothing on null/zero, invalid lines, shape or schema.
- `tests/runtime-local.test.js:155-181`: round-trips one `recordInference`; asserts `tipo`, `valid`, no raw prompt. Nothing on reader aggregation, zero-vs-null, or corrupt lines.
- `tests/hia-router.test.js:64-70` stubs the telemetry module. No test of `executor.js` metrics into telemetry, of `hia.controller.js`, or validating `hia-execution.schema.json`. No test for the cloud-engine usage path (none exists).
- Isolation defect: those tests do not set `HARNESS_ROOT` (grep empty), while `root.js:6-8` defaults to the real repo, so they append to the real `logs/telemetry/*.jsonl`. The 273 `git.status` lines (the test uses `git.status` with `tokensSaved: 1200`) are consistent with test-run pollution of production metrics [mechanism V; attribution of those lines A].

## 9. Gap list vs pre-plan 6.1

| # | Rule | Status | Evidence / gap |
|---|---|---|---|
| 1 | Per-call granularity, native evidence | Missing | Cloud engines produce no record (sec. 7); hia lines carry no native payload; shadow is 1 line per request. |
| 2 | Aggregate over unique calls, no parent+child double count | Missing / at risk | No call id, parent id or workflow/task link; `taskId` never written; hia vs shadow overlap undetectable (sec. 3). |
| 3 | Incremental vs cumulative vs update; resets, resends, re-imports | Missing | No `kind`/sequence field; `exec-<Date.now()>` is not idempotent; no dedupe on append or read. |
| 4 | No cache/reasoning double count; per-provider mapping | Missing | Schema has the fields but nothing populates them; `tokensTotal` undefined semantics; no provider/version mapping. |
| 5 | Null = unavailable, zero needs observation; estimates with method | Violated | Coercion to 0 in writer, client, readers (sec. 4); `tokensSaved` lacks method; `metricSource` exists only in the unused schema. |
| 6 | Separate human turns / model requests / attempts / tools / agent messages | Missing | One record kind per file; schema `attempts` unused; no event taxonomy (no ambiguous "interactions" counter yet). |
| 7 | Model/provider per call | Partial | shadow has `model`; hia has only `executorId`; no provider; cloud model unrecorded. |
| 8 | Coverage as metric with explicit denominator | Missing | Reader reports `lines.length` as total; nothing records calls expected vs observed. |
| 6.2 | Estimated / reported / billed cost | Missing | No cost field, price table, currency or effective date anywhere. |

## 10. Blocking questions

1. Which contract is canonical: extend `hia-execution.schema.json` (add cost, correlation, call-level ids, nullable tokens) and migrate both writers, or define a new event schema and treat both JSONL files as legacy? Keep the 275 + 386 mostly-zero legacy lines readable, or discard?
2. Do the Claude Code / Codex / Gemini / opencode CLIs, in the modes `tools/lib/engines/*` invoke, emit usage/cost in their JSON streams? Need sample native events per engine/version (no prompt content) before defining the per-provider mapping (rule 4).
3. Is subscription usage (no per-token bill) in scope, which decides whether "billed" cost can exist (pre-plan 6.2)?
4. Should tests be forced onto a temp `HARNESS_ROOT`, and should the polluted real log be purged or tagged before any baseline is computed?
5. What is the unit of `correlationId`: chat request, engine session, board task, or workflow run? `chatId` is per HTTP request and `sessionId` per engine conversation; neither equals a board task.
6. Retention and read strategy: acceptable maximum file size, and may a rollup/index be introduced, given each metrics request re-parses the whole file?

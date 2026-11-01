# 06 - Modelo de dados e eventos - epic EP-18 (provisional), ADR-014 (provisional)

Status: proposal; nothing implemented. Basis: Harness a89703c, DAI 7248777 (read-only). Consistent with 04 and 05 (option B) except where divergences are marked; they are collected in 10 section 2.
Tags: [Fact path:line], [Hypothesis], [Pending decision], [Proposed]. `svc/` = `ui/server/services/`, `ev/` = `ui/server/services/events/`.

## 1. Identifiers

| Name | Definition | Minted by / when | Store | Basis |
|---|---|---|---|---|
| `storyId` | existing `story.id` (local `us-<Date.now()>-rand`, Jira `jira-<id>`). `key` is display only | Scrum, at creation | scrum.json; event column `story_id` (new) | [Fact svc/project-scrum-sanitize.js:31] (docs 02/04/05 cite :29, wrong) |
| `demandId` | NOT an entity. A demand is a story with `maturity` in draft/refining; `demandId := storyId` | - | - | [Proposed] Demand entity deferred (05 s6) |
| `maturity` | draft, refining, ready | Scrum | `story.maturity` | [Proposed] |
| `implementationId` | `imp-<uuid>`, minted on first execution/link against a story; same story+branch reuses it; new branch/worktree = new one | trace service | event column `implementation_id` (new) | [Proposed]; branch per story [Fact tools/lib/opencode-package/worktree.js:2,17] |
| `executionId` = `runId` | chat: `runId = chatId`, minted before spawn; workflow: `executionId = wf-<uuid>` also sent as `runId` and `workflowRunId` | chat telemetry / engine | columns `execution_id`, `run_id`, `workflow_run_id` | [Fact svc/chat-run-telemetry.service.js:4; svc/orchestration/workflow-event-bridge.js:75-87] |
| `workflowRunId` | = workflow `executionId`; the workflow definition id+version go in payload (`feature-delivery@1.3.0`) | engine | column `workflow_run_id` | [Fact bridge.js:86] |
| `stepRunId` / `attemptId` | `<executionId>:stage:<id>` / `att-<uuid>` | engine | columns | [Fact bridge.js:93; raw-harness-sprint-workflow.md:21] |
| `correlationId` | NOT introduced. Maps to `traceId` (EP-08.04 `correlationId` -> `trace_id`) | - | column `trace_id` | [Fact bridge.js:88; ADR-TEL-003:34] |
| `traceId` | proposal: `traceId = implementationId` for every event of one implementation; else falls back to `runId`. The story join uses `story_id`, never `traceId` | trace service | column | [Pending decision] 05 s4 |
| `historyEntryId` | `<storyId>:<at>:<toSprintId>` (sprint), `<storyId>:<at>:<toMaturity>` (maturity); same shape as transition ids | Scrum | scrum.json | [Fact svc/project-scrum-transitions.js:51-62] |
| `testRunId` | `tr-<uuid>` minted by the test collector before spawn | collector | payload | [Proposed] |

Envelope reality [Fact ev/event-envelope.js:13-25]: `ID_FIELDS` = runId, parentRunId, traceId, agentId, taskId, workflowRunId, stepRunId, attemptId, engineInstanceId, nativeSessionId, idempotencyKey. There is NO `storyId` and NO `implementationId`. `taskId` is already used by `task.*` events (bridge.js:89), so it is not overloaded.

## 2. Event store changes (migration v2, additive)

| Edit | File:line | Note |
|---|---|---|
| append `["storyId","story_id"]`, `["implementationId","implementation_id"]` to `ID_FIELDS` | `ev/event-envelope.js:13-25` | flows automatically into `ENVELOPE_COLUMNS` (:32), `INSERT_SQL` placeholder count (`ev/event-store.js:105`), `rowToEvent` (:100) and ingest length validation (`ev/event-ingest.js:48-54`) |
| new migration step `migrateToV2` (add columns if absent via `PRAGMA table_info`, then `CREATE INDEX IF NOT EXISTS events_story ON events(story_id)` and `events_impl ON events(implementation_id)`) | `ev/event-migrations.js` after :52, called in the `BEGIN IMMEDIATE` block at :67-70 | pattern identical to `migrateToV1` (:42-52) |
| separate `DB_USER_VERSION = 2` constant | `ev/event-migrations.js:63` | TRAP [Fact]: the gate `readUserVersion(db) >= SCHEMA_VERSION` uses the envelope version (`event-envelope.js:8` = 1, also the max accepted `schemaVersion` at ingest, `event-ingest.js:44`). Reusing it would skip v2 for DBs already at 1, and INSERT would fail on missing columns. Either bump `SCHEMA_VERSION` to 2 (changes ingest range) or add the separate constant [Pending decision, recommend separate] |
| `readEvents` option `storyId` (and `implementationId`) | `ev/event-store.js:152-165` | today only `types`, `sessionId`, `cursor`; story timeline must use the index, not a scan (projectors page the full log, `ev/event-projector.js:47-59`) |
| existing test asserts `user_version == 1` | `tests/event-envelope.test.js:42` | must change to 2 in the same story |
| allowlist | `ev/event-type-allowlist.js:31-49` | add `TRACE_TYPES` to `ALLOWED_TYPES`; parity test in `tests/event-envelope.test.js` extended |

Downgrade [Fact]: old code opens a DB with higher `user_version` and leaves it as is (`event-migrations.js:57-58`, `:63`); its explicit-column INSERT leaves new columns null. Old retention would prune trace rows (section 6) so rollback of code requires a DB copy first (09).

## 3. scrum.json additions

Story fields (all additive, null/absent tolerated):

```ts
type Maturity = "draft" | "refining" | "ready";
interface StoryV3Fields {
  maturity: Maturity;                // legacy + Jira read as "ready" (loader default) [Pending decision #4]
  storyRevision: number;             // starts 1, +1 on every write by a Scrum route; server-managed
  intake?: { channel: "ui"|"chat"|"cli"|"jira"|"import"; type: "feature"|"bug"|"hotfix"|"chore"; urgent: boolean };
  createdBy?: Actor;                 // claimed, verified:false
  specRef?: { path: string; sha256: string; version: number };  // dossier file, never its text
  dedupeKey?: string;                // sha256(slug|intake.channel|normalized title|correlation) for idempotent creation
}
interface SprintHistoryEntry {       // new top-level array sprintHistory[]
  id: string;                        // <storyId>:<at>:<toSprintId|none>
  storyId: string; fromSprintId: string|null; toSprintId: string|null;
  requestedSprintId: string|null; effectiveSprintId: string|null;  // differ for Jira stories (resolver: Jira sprint wins)
  at: string; actor: Actor; reason: string|null; exception: boolean; storyRevision: number;
}
interface Actor { kind: "human"|"agent"|"system"; id: string /*<=80, a handle, no email*/; source: "ui"|"engine"|"collector"|"system"; verified: false }
```

Do not reuse `origin`: [Fact svc/project-scrum-ops.js:68] every non-Jira upsert forces `origin: "local"`, so 04 s2.4 `origin:hotfix` would be overwritten. Use `intake`.

Exact whitelist edits:

| Where | Edit |
|---|---|
| `saveProjectScrum` cleanData, `svc/project-scrum-persist.js:78-91` | add `sprintHistory: data.sprintHistory \|\| []`. Without it the key is silently dropped on next save [Fact :78-91] |
| `loadStoredProjectScrum`, persist.js:33-34 | add `data.sprintHistory = Array.isArray(data.sprintHistory) ? data.sprintHistory : []` |
| `sanitizeStory`, `svc/project-scrum-sanitize.js:30-45` | accept `intake`, `specRef`, `createdBy`, `dedupeKey` only when present in the payload (validated enum/length). `maturity` only at creation. `storyRevision` is NEVER read from the payload (mass assignment) |
| merge hazard, `svc/project-scrum-ops.js:71` | `{...existing, ...sanitized}` overwrites with whatever sanitize returns. New fields must be omitted when undefined, or an edit resets `maturity`. Same line plus sanitize.js:39 default `sprintId` to the active sprint: editing a backlog story without `sprintId` moves it into the sprint [Fact by reading, behaviour not executed]. Drafts need `sprintId` preserved on edit |
| Jira override entries, ops.js:20-31 and :53-58 | `maturity`/`storyRevision` set directly on `entry`; `localOverrides` list unchanged. Resolver pass-through of new fields to the resolved story is [Hypothesis], `svc/project-scrum-resolver.js` not re-read (spike SP-3) |
| `transitionHistory` / `impedimentHistory` records | add optional `actor`, `reason`; arrays are saved untouched (persist.js:87-88), so no whitelist change |

## 4. Migration scrum.json v2 -> v3 (modelled on `svc/project-scrum-migration.js`)

Recommendation [Pending decision #8]: bump `SCRUM_SCHEMA_VERSION` to 3, because old code reading v3 throws `UNSUPPORTED_SCRUM_SCHEMA` (migration.js:25-31) at `persist.js:23` (outside the try) = loud failure, whereas additive keys under v2 are silently dropped by old `saveProjectScrum`, which would erase audit history. This diverges from 05 s2 ("prefer additive").

| Aspect | Design |
|---|---|
| Id | `scrum-maturity-v2-to-v3`, appended to `migrationHistory` with `{fromVersion, toVersion, appliedAt, storiesDefaulted, sprintHistorySeeded:0}` |
| Content | per story: `maturity ??= "ready"`, `storyRevision ??= 1`; top level `sprintHistory ??= []`. No fabricated history: no seeded entries; the migration entry marks the start of recorded history |
| TRAP [Fact migration.js:32-62] | `migrateScrumData` returns early only when `fromVersion === SCRUM_SCHEMA_VERSION`, otherwise it applies the v1->v2 `laneId = legacyStatusToLane(status)` rewrite to every story. With the constant at 3, a v2 file would have all lanes overwritten. Must be refactored into chained steps `if (from < 2) stepV1toV2; if (from < 3) stepV2toV3` |
| Backup | `backupPathFor(file, 2)` -> `scrum.v2.backup.json`, `COPYFILE_EXCL` (migration.js:64-66, 89-91). Hazard: guarded by `!existsSync(backupFile)`, so after rollback + re-migration a stale backup is kept. Rule: rollback renames the backup to `scrum.v2.backup.<ts>.json` after restore [Proposed] |
| Rollback | `rollbackScrumFile(file, 2)` (migration.js:96-109) restores v2 atomically. Loses v3-only data written after migration (sprintHistory, maturity); the trace events keep the facts. Before rollback copy the v3 file to `scrum.v3.discarded.<ts>.json` [Proposed] |
| Idempotency | second run is a no-op (`changed:false`); tests in `tests/project-scrum-migration.test.js` extended |
| Save path | `saveProjectScrum` calls `migrateScrumData(cleanData)` (persist.js:93); `cleanData.schemaVersion` must be 3 after load or every save re-runs a step |
| Lock | no lock exists around read-modify-write (migration.js:68-83). Out of this migration; see story 18.06 |

## 5. Event types `trace.*`

Common payload for all (after `sanitizePayload`): `traceSchema: 1`, `evidenceClass`, `actor: Actor`. Envelope: `projectId` (slug), `storyId`, `traceId`. `source = {provider:"harness", kind:"trace-scrum"|"trace-engine"|"trace-collector"|"trace-reconciler"}` [Hypothesis on kind strings; provider scopes the UNIQUE idempotency index, `event-migrations.js:49-51`].

| Type | Required fields (payload unless envelope) | Class | Idempotency key |
|---|---|---|---|
| `trace.story.created` | storyId, intake, maturity, storyRevision, duplicateCandidates[ids] | validated (Scrum wrote it) | `trace\|story\|<storyId>\|created` |
| `trace.story.maturity.changed` | from, to, storyRevision, historyEntryId, gateEventId? | validated | `trace\|story\|<storyId>\|maturity\|<storyRevision>` |
| `trace.sprint.assigned` | historyEntryId, from, to, requestedSprintId, effectiveSprintId, exception, reason | validated | `trace\|sprint\|<historyEntryId>` |
| `trace.scope.changed` | fromRevision, toRevision, fields[], activeRunIds[] | observed | `trace\|scope\|<storyId>\|<toRevision>` |
| `trace.action.denied` | action, code (`UNAUTHORIZED`,`WRONG_PROJECT`,`STALE_REVISION`,`ILLEGAL_TRANSITION`), requestId | observed | `trace\|denied\|<requestId>` |
| `trace.implementation.linked` | implementationId (column), linkBasis: explicit/branch/trailer/manual, branch?, worktree? | observed or declared | `trace\|impl\|<implementationId>\|linked\|<storyId>` |
| `trace.run.started` / `.finished` / `.abandoned` | workflowId+version?, variant?, engine, outcome (finished), staleSince (abandoned, inferred) | observed (abandoned: inferred) | `trace\|run\|<runId>\|started` / `finished` / `abandoned` |
| `trace.stage.finished` | stageId, attempt, outcome: passed/failed/skipped, skippedBy: variant | observed | `trace\|stage\|<runId>\|<stageId>\|<attemptId>\|finished` |
| `trace.evidence.observed` | kind: commit/test/file, ref, verifiedAt; commit: sha, branch, trailerStoryId, linkBasis, patchId; test: testRunId, commandHash, exitCode, outputSha256 | observed | commit `trace\|evidence\|commit\|<sha>\|<implementationId>`; test `trace\|evidence\|test\|<testRunId>` |
| `trace.evidence.declared` | kind, claim (short), sourceRef (`_status.md` row hash or agent run) | declared | `trace\|declared\|<sourceRef>` |
| `trace.gate.evaluated` | gateId, checklistVersion, result: pass/fail/pending, mode: mechanical/human/both, evidenceIds[] (pass requires >= 1 observed id), storyRevision | validated only if cited evidence is observed | `trace\|gate\|<runId>\|<gateId>\|<attemptId>` |
| `trace.approval.recorded` | action, decision, approvalEventId, confirmationNonceHash | validated, actor verified:false | `trace\|approval\|<runId>\|<stageId>\|<seqNo>` |
| `trace.link.pending` / `.resolved` | pending: runId, reason; resolved: resolution: linked/created/dismissed, storyId?, dismissReason | inferred / validated | `trace\|link\|pending\|<runId>`, `trace\|link\|resolved\|<runId>\|<n>` |
| `trace.compensation.recorded` | compensates (event id or sha), kind: revert/rollback, byRef | observed | `trace\|comp\|<compensatesId>\|<byRef>` |

Design cost [Pending decision]: `trace.run.*` duplicates existing `run.started/finished` and `execution.*` (chat-run-telemetry.service.js:149-175). It is deliberate: retention class differs (section 6). Alternative: define audit class by `story_id IS NOT NULL`, no duplicate types, but tool/usage events stamped with a story would flood it.

Idempotency precedent [Fact]: `chat|<runId>|run.started` (chat-run-telemetry.service.js:152), `tool|<runId>|<toolUseId>` (:115), workflow `wf|<exec>|<type>|<task>[|<attempt>][|<ts>]` (bridge.js:47-53). Rule for trace: `trace|<entity>|<id>|<fact>[|<discriminator>]`; repeatable facts carry a monotone discriminator (revision, attempt, seqNo), never wall-clock alone.

## 6. Provenance classes and the ingest trust rule

[Fact ev/event-ingest.js:72-74] `trust=declared` is rejected with 422; `appendEvent` itself accepts it (`ev/event-store.js:29,84`), so only the ingest path enforces it: trace producers must call `ingestEvent`, never `appendEvent`. [Fact bridge.js:9-10] the engine already emits `relation: "declared"` for harness-defined links, so `relation` cannot separate "agent claim" from "engine fact".

| evidenceClass | Meaning | `trust` column | `relation` column | Who may write |
|---|---|---|---|---|
| declared | an agent/document says so (`_status.md` `[x]`, "tests pass") | `observed` (the system observed the claim being made) | `declared` | wrapper, from claim routes |
| observed | the system measured it (git object exists, exit code of allow-listed runner) | `observed` | `native` | collectors/engine only |
| validated | human approval or gate citing >= 1 observed evidence | `observed` | `native` | engine on approval/gate; Scrum for its own writes |
| inferred link (not a class) | heuristics, stale-run detection | `inferred` | `inferred` | reconciler |

Recommendation [Pending decision #2]: keep the frozen rule, carry the class in `payload.evidenceClass`, and let the wrapper (story 18.03) enforce it server-side: clients cannot choose `observed|validated`; the route/source stamps it. Alternative: allow `trust=declared` only for `trace.evidence.declared`, which unfreezes the contract.
Forgery surface [Fact]: `POST /events` accepts any allowlisted type (`ui/server/controllers/central-events.controller.js:145`), loopback only (:128-129). Adding `trace.*` to the shared allowlist would let any local client post `observed`. Wrapper must reject `trace.*` on the generic route, or force `evidenceClass=declared` there.

## 7. Ordering, replay, rebuild

- Arrival order (`seq`) is not fact order: reuse `stampOf/compareStamps` (`ev/event-order.js:27-41`): later `(at, seq)` wins per field; run status via `setExecutionStatus` (terminal wins, :77-87). Stage attempt outcome: terminal wins likewise.
- Replay of the same key returns `duplicated:true`, no row (`event-store.js:137-141`).
- Timeline = fold over `readEvents({storyId})` merged at read time with scrum.json `transitionHistory`, `sprintHistory`, `impedimentHistory` (no dual write; pointer events carry `historyEntryId` so the merge dedups).
- Rebuild: drop the cached projection, fold from cursor 0, compare with the previous snapshot. Deterministic as long as no input is pruned (hence section 8).
- Failure between JSON commit and event: reconciler lists history ids without a matching key `trace|sprint|<id>` and emits them with `late:true`, original `at`; idempotent, safe to repeat.

## 8. Retention exemption

[Fact ev/event-retention.js:19-25,35,63-68,94-96] operational events (every type except `usage.observed`) are capped at `operationalMax: 20000` per project, oldest deleted by `seq`. `trace.*` rows share that pool, so audit rows would be truncated. Edits [Proposed]: `countOperational` (:35) and `pruneOperational` (:66) exclude `type LIKE 'trace.%'`; `afterInsert` (:82) counts them separately; audit class gets its own cap or none [Pending decision #3, value not invented]. `gapAfter` (`event-store.js:181`) reports gaps for pruned history, so a pruned audit row is also visible to clients. The `events.sqlite` file sits under gitignored `projects/` (raw-git-tests-memory-mapa.md:11): no backup exists by default.

## 9. Redaction and privacy

Reuse `sanitizePayload` (`ev/event-sanitizer.js:127`): secret-like keys -> `[redacted]`; keys in TEXT_KEYS (prompt, content, text, stdout, stderr, arguments, tool_output...) dropped unless `HARNESS_EVENTS_CAPTURE_CONTENT=1` (:50-52); limits 6 depth, 50 keys, 100 items, 2000-char strings, 64 KB (:15). Rules [Proposed]: dossier text and conversation never stored (path + sha256 + version only); test output stored as `outputSha256`/`outputBytes`, never under a key outside TEXT_KEYS (e.g. `outputTail` would pass the filter); `reason` free text capped at 500 chars [Hypothesis]; actor id is a handle. Bridge precedent: drops `error`/`note`, keeps `errorLength` (bridge.js:60-68).

## 10. Examples

```json
{ "type": "trace.evidence.observed", "at": "2026-11-02T14:03:11.000Z",
  "source": { "provider": "harness", "kind": "trace-collector" }, "trust": "observed", "relation": "native",
  "projectId": "harness-leca", "storyId": "us-1790000000000-412", "implementationId": "imp-7c1e",
  "traceId": "imp-7c1e", "runId": "wf-91ab", "workflowRunId": "wf-91ab",
  "idempotencyKey": "trace|evidence|commit|9fceb02d0ae598e95dc970b74767f19372d61af8|imp-7c1e",
  "payload": { "traceSchema": 1, "evidenceClass": "observed", "kind": "commit",
    "sha": "9fceb02d0ae598e95dc970b74767f19372d61af8", "branch": "feat/story-412",
    "trailerStoryId": "us-1790000000000-412", "linkBasis": "trailer", "verifiedAt": "2026-11-02T14:03:11.000Z",
    "actor": { "kind": "system", "id": "git-collector", "source": "collector", "verified": false } } }
```

Mapping to DAI `_status.md` `## Historico` (columns `Data | Estado | Executor | Gate | Observacao`, [Fact DAI:skills/orquestracao/sdlc-pipeline/SKILL.md:52-74]): export renders `trace.stage.finished` + `trace.gate.evaluated` as `at | stageId | actor.id or agent | gateId PASS or FAIL n/2 | summary + evt:<eventId>`. Import (optional, phase 5) turns each row into `trace.evidence.declared` with `sourceRef = sha256(row)`; never into validated. The markdown stays declared evidence (addendum item 4).

# 07 - Matriz de estados e gates - epic EP-18 (provisional)

Status: proposal; nothing implemented. Basis: Harness a89703c, DAI 7248777 (read-only). IDs, events and fields come from 06.
Tags: [Fact path:line], [Hypothesis], [Pending decision], [Proposed]. `svc/` = `ui/server/services/`.

## 1. Axes

| Axis | Values | Persisted or derived | Owner | Where |
|---|---|---|---|---|
| Maturity | draft, refining, ready | persisted `story.maturity` (+ `storyRevision`) | Scrum | scrum.json; legacy/Jira read as ready [Pending decision #4] |
| Planning | unassigned, selected | persisted `sprintId` + `sprintHistory[]`; "committed" derived (selected and a run started after) | Scrum | scrum.json |
| Lane | 12 fixed ids | persisted `laneId` + `transitionHistory[]` | Scrum | [Fact svc/project-scrum-lanes.js:4-15; svc/project-scrum-transitions.js:44-47 adjacent-only] |
| Stage | start, story, bdd, prototype, modeling, dev, tests, review, commit-pr, deploy | derived from latest `trace.stage.finished` of the active run | Runtime | [Fact svc/orchestration/agent-stage-definitions.js:60-175] |
| Execution | queued, running, waiting_approval, passed, failed, abandoned, cancelled | derived from run events (terminal wins, `ev/event-order.js:77-87`) | Runtime | events |
| Impediment | flag + `impedimentHistory[]` | persisted, Scrum | Scrum | [Fact svc/project-scrum-ops.js:121-137]; not the same as execution `blocked` |

Rules: no axis writes another. The runtime never writes `laneId`, `sprintId` or `maturity`; it may emit a suggestion shown in the UI. Lane names/order are configurable and ids fixed (raw-scrum-core.md:10), so lane cannot encode maturity.

## 2. Transition table

Actor column = who may trigger; "claimed" = free-text handle, `verified:false` until authentication exists (section 6). Every row writes the audit record named; denials write `trace.action.denied`.

### 2.1 Maturity

| From -> To | Trigger | Preconditions | Audit record |
|---|---|---|---|
| (none) -> draft | human, agent, or intake channel (chat, CLI, UI) | title present; `sprintId` forced null; dedupe suggestion computed, never blocking | `trace.story.created` |
| draft -> refining | human, or refinement agent run bound to story | none beyond existence | `trace.story.maturity.changed` |
| refining -> ready | human only (claimed PO handle); agent cannot | DoR gate `dor.v1` result pass with every mechanical item passed and human item approved (section 4); `specRef.sha256` recorded | `trace.gate.evaluated` + `trace.story.maturity.changed` citing gateEventId |
| draft -> ready | forbidden by default; allowed as audited exception (urgent or hotfix only) | reason + actor + `exception:true` | maturity event with `exception` |
| ready -> refining | human, or automatic proposal on scope change (applied only on human confirm) | `storyRevision` changed in `acceptanceCriteria` or `specRef` since the passing DoR | maturity event + `trace.scope.changed` |
| any -> rejected (optional) | human | reason | maturity event [Hypothesis: not needed for MVP] |

### 2.2 Planning (sprint)

| Transition | Trigger | Preconditions | Audit record |
|---|---|---|---|
| unassigned -> selected | human (PO/SM, claimed) via assign-sprint | `maturity == ready`, `expectedRevision == storyRevision` (else 409), sprint exists | `sprintHistory` entry + `trace.sprint.assigned` |
| unassigned -> selected, not ready | human + `exception:true` | story is `intake.urgent` or `intake.type == hotfix`, reason non-empty | same, `exception:true`; UI shows "unrefined in sprint" badge |
| selected -> unassigned | human | reason; if a run exists, also `trace.scope.changed` | history + event |
| selected -> other sprint (carry-over) | human | reason `carry-over`; no sprint close op exists today [Fact raw-harness-sprint-workflow.md:12], so carry-over is manual | history + event |
| Jira story | human | the Jira sprint wins in the resolver (`source.sprintId ?? localStory.sprintId`, svc/project-scrum-resolver.js:35,54); record `requestedSprintId` and `effectiveSprintId`, show warning when they differ | history + event |

### 2.3 Execution and stage

| Transition | Trigger | Preconditions | Audit record |
|---|---|---|---|
| (start) -> queued/running | human via UI or engine on a routine; never by lane move [Fact: lane move does not call the runner, raw-harness-sprint-workflow.md:30] | story exists in this project; `storyId` present or `trace.link.pending`; no other active claim by a different provider (advisory warning, not block in MVP) | `trace.run.started` |
| running -> waiting_approval | engine | stage in APPROVAL set | `approval.requested` (existing) |
| waiting_approval -> running/failed | human decision | decision + actor + nonce (section 6) | `trace.approval.recorded` |
| stage attempt fail -> new attempt | engine | attempt count below `max_retries_per_state` (2, `DAI:workflows/feature-delivery/manifest.yaml:69-71`); tests/review fall back to dev (DAI manifest) | `trace.stage.finished` outcome failed, new `attemptId` |
| running -> failed/passed/cancelled | engine; cancel by human | evidence rules of section 3 | `trace.run.finished` |
| running -> abandoned | reconciler | `run.started` with no finish for longer than threshold [Pending decision, not invented] | `trace.run.abandoned` (inferred) |

### 2.4 Lane (unchanged)

Only `moveStoryToLane` writes it (svc/project-scrum-ops.js:84-98), adjacent-only, origin lane must match (409 `SCRUM_STORY_CONFLICT`, transitions.js:34-38). Added: optional `actor`/`reason` on the history record; failed validation emits `trace.action.denied code=ILLEGAL_TRANSITION`. Runtime suggestion mapping (display only): draft/refining -> backlog/discovery/refinamento; ready -> pronto-para-dev; stage dev -> em-desenvolvimento; review -> em-revisao; tests -> em-testes. A suggestion needing a skip is shown, never applied.

## 3. Evidence rule behind every "passed"

- A stage or run may be recorded `passed` only if at least one `trace.evidence.observed` id is cited (DAI invariant; `DAI` 06-INTEGRACAO s6 via 04 s7).
- A story cannot reach `concluido` by declared evidence alone [Hypothesis: warn-only in MVP, lanes untouched per addendum items 2 and 5; hard block is a later policy].
- Agent text "tests pass" -> `trace.evidence.declared`; shown grey; gate stays pending.

## 4. DAI gate ids -> Harness stage gates

DAI gates [Fact raw-dai-stories-gates.md:28; `DAI:workflows/feature-delivery/manifest.yaml` ~l.319-397]: `requires` is the only mechanical part; most `checks` are prose; `approval: user` except `dossier-created: auto`. Harness today: gate = text per stage, no executable checker (raw-harness-sprint-workflow.md:24,48); approval stages are only prototype, commit-pr, deploy (`svc/orchestration/workflow-definitions.js:7-12`), narrower than DAI, which asks the user at every gate except the first [Pending decision: align].

| DAI gate id | Harness stage | Mechanical (script-checkable) | Human approval | Class |
|---|---|---|---|---|
| dossier-created | start | `docs/features/<slug>/_status.md` exists. Harness has no dossier convention (`docs/features/` absent, raw-git-tests-memory-mapa.md:14): path per project [Pending decision] | none (auto) | mechanical |
| story-approved | story | `01-story.md` exists; numbered acceptance criteria present; open questions have owners | PO/BA approval | both |
| bdd-approved | bdd | `02-bdd.feature` exists; scenario count >= criteria count [Hypothesis, rule not in DAI] | approval | both |
| prototype-approved | prototype | `03-prototipo.md` exists | approval (also Harness approval stage) | both |
| modeling-approved | modeling | `04-modelagem.md` exists | approval | both |
| implementation-done | dev | build and lint exit 0 via allow-listed command. Candidate in this repo: `npm run check` [Hypothesis: `scripts/check.js` content not read]. Other projects: command per project [Pending decision] | DAI says user approval | mechanical + approval |
| tests-green | tests | suite exit 0 (`npm test`); every BDD scenario mapped to a test (needs tag convention [Hypothesis]) | WCAG item and coverage judgement | both |
| review-clean | review | no open blocker items in `07-code-review.md`; reviewer handle differs from author handle (weak, unverified) | human reviewer not the author | human (mechanical is advisory) |
| pr-opened | commit-pr | commit message matches Conventional Commits regex; SHA verified in `repoRoot` | explicit confirmation every time (`DAI:manifest.yaml:305`); Harness `APPROVAL_STAGES` | both |
| deploy-validated | deploy | CI status and smoke test: no CI client in the Harness [Pending decision] | explicit confirmation every time (`DAI:manifest.yaml:317`) | human until a CI source exists |

Evaluation record: `trace.gate.evaluated {gateId, mode, items[], evidenceIds[], result, storyRevision}`. Mechanical items run on the Harness side as pure functions over files and exit codes; the DAI prose `checks` remain the human checklist. Gate definitions are read from the pinned DAI manifest snapshot, never retyped (drift test, story 18.18).

## 5. Definition of Ready as a reproducible gate (`dor.v1`)

Source checklist [Fact raw-dai-stories-gates.md:26]: INVEST, numbered verifiable criteria, explicit rules, measurable NFR, out of scope, dependencies, open questions with owner, prototype reference. DAI judges it by hand (prompt only).

| Item | Mode | Pure check |
|---|---|---|
| criteria present and each non-empty | mechanical | `story.acceptanceCriteria.length >= 1` and no blank entry |
| criteria verifiable | human | reviewer marks |
| out-of-scope section | mechanical | heading present in the spec file referenced by `specRef` |
| open questions have owners | mechanical | each question line matches `- <owner>` pattern [Hypothesis on pattern] |
| estimate present | mechanical | `points != null` |
| spec file exists, hash recorded | mechanical | `sha256(file) == specRef.sha256` |
| independent, valuable, small, testable (INVEST) | human | approval |
| NFR has a metric | human | approval |

Reproducibility: result is a function of `(checklistVersion, specRef.sha256, storyRevision)`. The same inputs give identical mechanical results (unit test). Human items are recorded as approvals with a claimed actor. `ready` is set only when all mechanical items pass AND the human approval exists. Any later change to `acceptanceCriteria` or `specRef.sha256` bumps `storyRevision`, marks the DoR stale and proposes `ready -> refining`.

## 6. Authorization and risk confirmation (no authentication)

Facts: no auth, RBAC or session user in `ui/server` (raw-harness-sprint-workflow.md:33-34); approval actor is free text up to 80 chars (`controllers/orchestration-approvals.controller.js:33`); event publish route is loopback only (`ui/server/controllers/central-events.controller.js:128-129`); default bind is `127.0.0.1`, and `--remote`/`--lan`/`--host` binds `0.0.0.0` with a 6-digit PIN printed on the terminal (`ui/server/config.js:11-14`). The PIN gates the remote client; it is not an identity. [Pending decision #1: single local user? remote mode in use?]

| Concept | Rule |
|---|---|
| Actor claimed | `actor.id` string supplied by the client or agent, `verified:false` always, UI label "claimed by" |
| Actor verified | impossible today. When authentication exists add `principalId` and `verified:true` additively; no history rewrite |
| Source | `actor.source` stamped by the server from the route (ui, engine, collector), never from the body (mirrors dropped `ingestedAt`, event-ingest.js:83) |
| Human-only actions | maturity -> ready, sprint exception, approvals for commit-pr/deploy, delete story. Requests with `actor.kind=agent` are denied and audited. Strength [Hypothesis]: low, since an agent on the same host can post `kind=human` |
| Fail secure | missing actor, unknown story, wrong project, stale revision, or any validation error = deny + `trace.action.denied`, generic public message (security-by-default) |
| Project scope | slug from the route; `storyId` must exist in that project's scrum.json; otherwise `WRONG_PROJECT`, nothing linked, nothing exposed |

Risk tiers:

| Tier | Actions | Requirement |
|---|---|---|
| 0 | read, timeline, suggestions | none |
| 1 | create draft, link/dismiss pending, impediment, lane transition | claimed actor + valid revision |
| 2 | maturity -> ready, assign-sprint, sprint exception, DoR approval, scope-change reopen | claimed actor + reason (exceptions) + human-only |
| 3 | commit-pr, deploy, push/PR, destructive delete | separate confirmation event: `approval.requested` returns a server-minted nonce bound to `(runId, stageId, action)`; `trace.approval.recorded` must present it; stored as hash. Never inferred from chat text. Harness prepares and records; it does not run commit, push, PR or deploy itself (no app-created commits exist, raw-git-tests-memory-mapa.md:7) |

Honest limit [Hypothesis]: with no authentication the nonce is tamper-evidence and an anti-accident control, not protection against a local process that can call the API. This must be accepted explicitly or authentication scoped first (Pending #1).

## 7. Sprint selection rules (summary)

1. Only `ready` stories may be selected; `refining` and `draft` stay in the Product Backlog.
2. Exception only for `intake.urgent` or hotfix: actor + non-empty reason, `exception:true` in `sprintHistory` and in `trace.sprint.assigned`.
3. A hotfix run does not require selection; it requires a story id (emergency story, 04 s2.4) and opens a post-incident backfill task (spec, maturity, incident link). The task is Scrum-side; DAI has no such rule (raw-dai-stories-gates.md:31).
4. Every change writes history `{from, to, at, actor, reason, exception}`; no silent `sprintId` mutation (today `assignStorySprint` writes only `sprintId`/`updatedAt`, ops.js:100-107).
5. Scope change after start: bump `storyRevision`, emit `trace.scope.changed` listing active runs, flag those runs `staleSpec`; runs are not killed; DoR becomes stale.
6. New stories do not default into the active sprint when `maturity != ready` [Fact: today they do, sanitize.js:39 and ops.js:61; default change is Pending decision #4].

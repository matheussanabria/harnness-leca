# 02 - Diagnostico atual (AS-IS) - Harness Leca e DAI

Status: planning only, no code changed. Date: 2026-10-31.
Basis: Harness worktree commit a89703c, branch docs/scrum-traceability-plan. DAI repo HEAD 7248777, branch dev, with uncommitted edits (listed in 01-discovery/raw-dai-pipeline.md, none touch feature-delivery or `_status.md`). DAI was read, never run.
Tags: [Fact path:line], [Hypothesis], [Pending decision]. DAI evidence is written `DAI:<path>`; Harness evidence is a plain path. Paths under `ui/server/services/` are abbreviated `svc/`. Line numbers taken from 01-discovery/*; the sprint/workflow file marks some as approximate, so re-verify before quoting in an ADR. Lines I re-read in this pass: svc/project-scrum-ops.js:40-110, svc/project-scrum-sanitize.js:39, svc/events/*, svc/chat-run-telemetry.service.js:1-160, svc/orchestration/workflow-run-store.js:1-50.
Priority on conflicts: code and tests > repo docs > v3 addendum > v2 hypotheses. Conflicts are listed in section 4, none fixed silently.

## 1. Component and source-of-truth map (who owns what today)

| Data / concern | Owner today | Store | Evidence |
|---|---|---|---|
| Stories, sprints, epics, lanes, lane order | Scrum services | `projects/<slug>/scrum.json` (JSON, one per project, whitelisted keys) | [Fact svc/project-scrum-persist.js:15,78-100,81] |
| Story lane transitions | Scrum services | `transitionHistory[]` in scrum.json | [Fact svc/project-scrum-ops.js:93-96; svc/project-scrum-transitions.js:51-62] |
| Impediments | Scrum services | story flag + `impedimentHistory[]` | [Fact svc/project-scrum-ops.js:121-137] |
| Sprint assignment | Scrum services | `story.sprintId` only, no history | [Fact svc/project-scrum-ops.js:100-107] |
| Jira stories | Jira snapshot (read-only) + local override entry | snapshot files read from `repoRoot` | [Fact svc/project-scrum-jira-source.js:51,75; svc/project-scrum-resolver.js:35,54] |
| Doc-derived stories | doc source | read from `repoRoot` | [Fact svc/project-scrum-doc-source.js (raw-scrum-core:8)] |
| Lane to skill bindings | skill-bindings service | `projects/<slug>/skill-bindings.json` | [Fact svc/skill-bindings.service.js:130 (raw-scrum-core:21)] |
| Workflow plan (lane to stages to skills) | orchestration | computed, not stored | [Fact svc/orchestration/workflow-plan.service.js:49-80] |
| Workflow runs, attempts | orchestration engine | in-memory Map, MAX_RUNS 200, lost on restart | [Fact svc/orchestration/workflow-run-store.js:4-21] |
| Workflow trace | workflow-event-bridge | SQLite event store (best effort) | [Fact raw-harness-sprint-workflow.md "Durable trace"] |
| Approvals | workflow-approval service | run memory + event; actor free text (80 chars) | [Fact raw-harness-sprint-workflow.md:23] |
| Chat run lifecycle (runId = chatId) | chat-run-telemetry | SQLite event store | [Fact svc/chat-run-telemetry.service.js:4,34,149-153] |
| Canonical sessions | canonical-sessions | `projects/<slug>/canonical-sessions.json` | [Fact raw-agents-coordination.md:12] |
| Agent claim/lease/handoff | coordination ledger (ADR-007) | `projects/<slug>/coordination/{state.json,events/}` via `tools/coordination.js` | [Fact tools/lib/coordination/storage.js:6-17; reducer.js:10-64] |
| Event log | events service | `projects/<slug>/coordination/events.sqlite` (node:sqlite, WAL) | [Fact svc/events/event-store.js:10,16,69] |
| Memory | memory CLI | `projects/<slug>/memory/**.md`, one fact per file | [Fact tools/lib/memory/item.js:5-17] |
| File index | MAPA tooling | `docs/mapa/**`, derived index | [Fact raw-git-tests-memory-mapa.md:12] |
| Git operations | shell spawn; no app commits | repo, worktrees `C:/Temp/hl-<id>` | [Fact tools/lib/opencode-package/worktree.js:2,13,17] |
| Specialists, skills, workflow definitions | DAI | `.agents/`, `skills/`, `workflows/` | [Fact DAI:README.md:26,50-56] |
| Feature dossier and stage state | DAI skill (prompt only) | `docs/features/<slug>/_status.md` (markdown, no frontmatter) | [Fact DAI:skills/orquestracao/sdlc-pipeline/SKILL.md:52-74] |

Note [Fact]: the same stage list lives twice. The Harness copy is hardcoded and says its source is `dai/workflows/feature-delivery/WORKFLOW.md` (svc/orchestration/agent-stage-definitions.js:60-175); the DAI copy is `DAI:workflows/feature-delivery/manifest.yaml:77-121`. Drift risk is real; no check compares them. [Hypothesis] no check exists (not found in discovery grep).

## 2. AS-IS diagram (both systems)

```mermaid
flowchart LR
  subgraph HL[Harness Leca - a89703c]
    UI[Scrum UI design-scrum*.js] -->|13 routes /api/project/slug/scrum| SC[Scrum services]
    SC -->|atomic tmp+rename, no lock| SJ[(scrum.json)]
    JS[(Jira snapshot + doc stories in repoRoot)] --> SC
    CH[POST /api/chat] --> CRT[chat-run-telemetry]
    CRT --> EV[(events.sqlite per project)]
    ORCH[Orchestration engine: stages, attempts, approvals] -->|workflow-event-bridge| EV
    ORCH --> RS[(in-memory run store)]
    CL[tools/coordination.js ledger] --> LG[(coordination/state.json + JSONL)]
    SB[(skill-bindings.json)] --> ORCH
    GIT[git via spawnSync, worktrees] -.no link.-> SJ
  end
  subgraph DAI[DAI - 7248777, no runtime, no tests]
    AG[.agents 17] --- SK[skills incl. sdlc-pipeline]
    WF[workflows feature-delivery active v1.3.0] --- SK
    SK -->|Claude Code session follows prompt| DOS[(docs/features/slug/_status.md + 01..09 docs)]
    EXP[export_claude_code.py / export_native.py] --> ENG[Claude, Codex, OpenCode, antigravity]
    HK[dai_guard.py PreToolUse hook] -.fail-open.-> ENG
  end
  ORCH -. hardcoded copy of stages .-> WF
  SC -. no read of _status.md .-x DOS
```

[Fact] The two dotted links are the only couplings: a hardcoded stage copy (agent-stage-definitions.js:60-175) and skill listing via `listProjectSkills` (svc/orchestration/workflow-plan.service.js:23-31). No Harness code reads `_status.md` (raw-harness-sprint-workflow.md:25). The Scrum store has no link to chat, session, agent, commit, branch, file or evidence (raw-scrum-core.md:21).

## 3. Matrix Existente / Parcial / Ausente / Desconhecido

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Story persistence | Existente | svc/project-scrum-persist.js:15,81 |
| 2 | Central story ID generator | Parcial (ad hoc `id \|\| key \|\| us-<Date.now()>-rand`) | svc/project-scrum-sanitize.js:29 |
| 3 | Product Backlog vs Sprint Backlog | Existente (derived from `sprintId` falsy) | svc/project-scrum-persist.js:41-42 |
| 4 | Draft / Demand concept | Ausente | raw-harness-sprint-workflow.md:8 |
| 5 | Sprint close / carry-over | Ausente | raw-harness-sprint-workflow.md:11,42 |
| 6 | Sprint entry/exit history | Ausente | svc/project-scrum-ops.js:100-107 |
| 7 | Epic model | Existente (minimal, no status/dates) | raw-harness-sprint-workflow.md:14 |
| 8 | Epic UI | Desconhecido | raw-harness-sprint-workflow.md:15 |
| 9 | 12 canonical lanes (ids fixed, names/active/order configurable) | Existente (but different 12) | svc/project-scrum-lanes.js:4-15 |
| 10 | Impediment | Parcial (flag + history, no lane, no actor) | svc/project-scrum-ops.js:121-137 |
| 11 | Transition rules | Parcial (adjacent-only, no matrix) | svc/project-scrum-transitions.js:44-47 |
| 12 | Story-move optimistic check | Existente (fromLaneId, 409) | svc/project-scrum-transitions.js:34-38 |
| 13 | `lanesRevision` | Existente, lane config only | svc/project-scrum-ops.js:166-196 |
| 14 | Per-story revision | Ausente | raw-scrum-core.md:14 |
| 15 | Atomic write / lock on scrum.json | Parcial (atomic yes, lock no) | svc/project-scrum-migration.js:68-83 |
| 16 | Transition history | Parcial (no actor/reason/correlation) | svc/project-scrum-transitions.js:51-62 |
| 17 | Migration with backup/rollback | Existente | svc/project-scrum-migration.js |
| 18 | Actor / auth / RBAC | Ausente | scrum-transition.controller.js; raw-harness-sprint-workflow.md:34 |
| 19 | Approval | Parcial (free-text actor; routine approver empty, unenforced) | raw-harness-sprint-workflow.md:23 |
| 20 | Workflow engine with DAI stages | Existente | svc/orchestration/agent-stage-definitions.js:60-175 |
| 21 | Run/attempt persistence | Parcial (memory; events to SQLite) | svc/orchestration/workflow-run-store.js:4-21 |
| 22 | storyId on run/event | Ausente (run has laneId, envelope has no storyId) | workflow-run-store.js:45; svc/events/event-envelope.js:13-25 |
| 23 | Executable quality gate | Ausente (text only) | raw-harness-sprint-workflow.md:24 |
| 24 | Lane move triggers runner | Ausente | raw-harness-sprint-workflow.md:30 |
| 25 | Reads `_status.md` | Ausente | raw-harness-sprint-workflow.md:25 |
| 26 | SQLite append-only event store, idempotent | Existente | svc/events/event-store.js:103-144; event-migrations.js:49-51 |
| 27 | Event retention | Existente: operational cap 20000 per project deletes oldest | svc/events/event-retention.js:19-25 |
| 28 | Closed event-type allowlist (no story/commit types) | Existente | svc/events/event-type-allowlist.js:49 |
| 29 | Ingest contract: `trust=declared` rejected | Existente | svc/events/event-ingest.js:72-74 |
| 30 | Chat run start/finish events | Existente | svc/chat-run-telemetry.service.js:149-153 |
| 31 | cwd / branch / worktree in run events | Ausente | svc/events/event-envelope.js:13-25 |
| 32 | Claude PostToolUse hook / file-change capture | Ausente | .claude/settings.json (only UserPromptSubmit) |
| 33 | Coordination ledger code | Existente; NOT initialized for harness-leca here | tools/lib/coordination/storage.js:6-17 |
| 34 | Claim/lease/handoff, keyed by storyId | Existente | tools/lib/coordination/reducer.js:10-17,50-64 |
| 35 | Per-file ownership, commit/branch in ledger | Ausente | reducer.js:53 |
| 36 | Canonical session registry | Existente | svc/canonical-sessions/ |
| 37 | App-created commits; story trailer; commit-msg hook | Ausente | raw-git-tests-memory-mapa.md:6,25-26 |
| 38 | pre-commit gates (secrets, map, affected tests) | Existente; never edits message | scripts/pre-commit.js:1-10 |
| 39 | Branch/worktree per story | Existente (story packages) | tools/lib/opencode-package/worktree.js:2,17 |
| 40 | Persisted test result | Ausente in hooks; Desconhecido in test-execution service | svc/audit/test-execution.service.js:1-30 |
| 41 | Redaction | Existente | tools/lib/redact.js; svc/events/event-sanitizer.js |
| 42 | Jira read | Existente; Jira write Ausente | tools/jira-query.js; ADR-008 proposta |
| 43 | Feature dossier `docs/features/` | Ausente | raw-git-tests-memory-mapa.md:14 |
| 44 | Project isolation | Existente per directory; Parcial for shared `repoRoot` sources | svc/project-scrum-persist.js:65-66 |
| 45 | Server bind address / network exposure | Desconhecido (no `.listen(` hit in ui/server entry globs) | grep, this pass |
| 46 | DAI executable runtime | Ausente (only `dai_guard.py` hook) | DAI:harness/cli.py manages projects only |
| 47 | DAI tests / CI | Ausente | DAI repo tree |
| 48 | DAI run IDs / structured events | Ausente (only `Historico` table) | DAI:docs/architecture/00-metamodelo.md:285 |
| 49 | DAI gate enforcement | Parcial: only `requires` file-existence is mechanical | DAI:workflows/feature-delivery/manifest.yaml:319-397 |
| 50 | DAI DoR / DoD | DoR human checklist Existente; DoD Parcial (per story) | DAI:skills/produto/requirements-engineering/validation/checklist.md |

## 4. PREMISE CORRECTIONS (user documents vs code)

Classification: Confirmado / Documentado mas nao confirmado / Proposto / Incompativel.

| # | Claim in the user's package | Finding | Class | Evidence |
|---|---|---|---|---|
| P1 | 12 lanes: Impedimento, Especificacao, Prototipacao, Modelagem, Pronto p/ Dev, Em Dev, Em revisao, Em testes, Testado, Em homologacao, Homologado, Concluido (CONTEXTO s2) | Real ids: backlog, discovery, refinamento, pronto-para-dev, em-desenvolvimento, em-revisao, pronto-para-testes, em-testes, pronto-para-homologacao, em-homologacao, pronto-para-deploy, concluido. Count 12 matches; names do not. | Incompativel | svc/project-scrum-lanes.js:4-15 |
| P2 | An `Impedimento` lane exists | No lane; impediment is a story flag `{active, reason, since, resolvedAt}` plus `impedimentHistory` | Incompativel | svc/project-scrum-ops.js:121-137 |
| P3 | `lanesRevision` protects concurrency of story changes | It guards only lane configuration (`SCRUM_LANES_CONFLICT`, 409). Story edits, assign-sprint and impediments have no revision. Story moves use an origin-lane check (`fromLaneId`, `SCRUM_STORY_CONFLICT`). | Incompativel (partial truth) | svc/project-scrum-ops.js:166-196; svc/project-scrum-transitions.js:34-38 |
| P4 | Transition matrix, permissions, approvals, audit actor | No matrix (adjacent-only), no actor/role/auth in Scrum controllers, history records have no actor. The "approval" actor is a free-text string. | Incompativel | svc/project-scrum-transitions.js:44-47,51-62; raw-harness-sprint-workflow.md:23 |
| P5 | ADR-005 SQLite event store is a proposal ("considerar eventos append-only e SQLite apos inspecao", CONTEXTO s9) | Implemented: node:sqlite store, idempotent insert, migrations, projectors, retention, allowlisted ingest. ADR file still says `status: proposta`. | Confirmado (code ahead of ADR status) | svc/events/event-store.js:10,103-144; docs/harness-evolution/03-decisions/ADR-005-eventos-persistentes-sqlite.md:4 |
| P6 | Coordination via `state.json` + JSONL under ADR-007 | Exists and is accepted, but not initialized for harness-leca in this worktree; it is a per-project JSON ledger, SQLite deferred. | Confirmado (not active here) | ADR-007:3; tools/lib/coordination/storage.js:6-17 |
| P7 | `tools/coordination.js` is part of the DAI ecosystem (DAI skill documents `claim/handoff/...`) | The code lives in Harness; DAI only has documentation (`tools/` holds only notion-sync). | Incompativel (DAI side) | DAI:skills/orquestracao/multi-agent-coordination/SKILL.md:42-74; tools/coordination.js |
| P8 | `feature-delivery` is draft; only `product-delivery` is draft (v3 addendum is ambiguous) | feature-delivery is `active` v1.3.0; product-delivery is `draft` v1.0.0 and has no end-to-end adapter. | Incompativel for feature-delivery; Confirmado for product-delivery | DAI:workflows/feature-delivery/manifest.yaml:12 |
| P9 | DAI "executes" feature-delivery (SKILL "executa o workflow") | No runtime. A Claude Code session follows prompt text; one stage per request; "next step only stated, never launched". | Documentado mas nao confirmado, refuted for runtime | DAI:SKILL.md:21,32-37,81-85; harness/cli.py |
| P10 | DAI has quality gates applied mechanically | Prompt-enforced; only `dai_guard.py` (fail-open) guards push/PR/deploy/commit-on-main. | Documentado mas nao confirmado | DAI:policies/hooks/dai_guard.py |
| P11 | DAI has tests/CI | None (no `tests/`, no `.github/`). Validators exist (`validate_workflow.py`, 290 lines) but were not run. | Incompativel | DAI repo tree |
| P12 | Harness has no pipeline/specialists (v2 premise; addendum corrects) | Harness engine already defines stages start..deploy, `feature-delivery` and `hotfix` workflows, approval stages, per-stage permissions; stage list copies DAI. Runs stay in memory. | Incompativel with v2; Confirmado for addendum | svc/orchestration/agent-stage-definitions.js:60-175; workflow-definitions.js:17-41; workflow-run-store.js:4-21 |
| P13 | "A sprint should not receive unrefined stories"; drafts live in Product Backlog (sprintId null) | New local stories default into the ACTIVE sprint when `sprintId` is absent, so "backlog" and "new" are not the same and no draft concept exists. | Incompativel | svc/project-scrum-sanitize.js:39; svc/project-scrum-ops.js:61 |
| P14 | SprintAssignment keeps entry/exit history ("manter historico") | `assignStorySprint` writes only `sprintId` and `updatedAt`; no actor, previous sprint or history. | Incompativel | svc/project-scrum-ops.js:100-107 |
| P15 | `_status.md` is a candidate source (SKILL, addendum item 4/7) | No code in `ui/server` reads it; format is markdown without frontmatter or IDs; the skill reads the manifest from `workflows/global/...` (an export-injected copy), not from the repo path. | Documentado mas nao confirmado | DAI:SKILL.md:19,52-74; raw-harness-sprint-workflow.md:25 |
| P16 | Events can carry `storyId` | Envelope ID_FIELDS has no storyId/cwd/branch; the type allowlist is closed and has no story/commit/test types; `trust=declared` is rejected at ingest. | Incompativel | svc/events/event-envelope.js:13-25; event-type-allowlist.js:49; event-ingest.js:72 |
| P17 | Audit events are retained for replay | Operational events are capped at 20000 per project, oldest deleted. An audit class would be silently truncated unless exempted. | Incompativel with replay premise | svc/events/event-retention.js:19-25 |
| P18 | Jira is integrated | Read-only offline snapshot; no write path in Harness; ADR-008 still proposta. DAI has an authorized-per-item Jira publishing skill. | Confirmado (read) / Ausente (write) | tools/jira-query.js; DAI:skills/produto/jira-story-publishing/SKILL.md:41-47 |
| P19 | DAI README: 17 agents | 17 agent folders; README table has 18 rows (legacy orchestrator). | Confirmado (with note) | DAI:README.md:26,95-114 |
| P20 | DAI is Claude-first and multi-engine capable | Export to claude, codex, opencode, antigravity (no separate Gemini); non-Claude loses hooks, subagent delegation, sandboxing, manifests, global rule injection. | Confirmado | DAI:scripts/export_native.py (untracked) |
| P21 | EP numbering free | EP-16 is reserved by ADR-011 (stories 16.00-16.05, frontend); this work uses provisional EP-17 and ADR-012. ADR-011 is untracked on another branch; not verifiable in this worktree. | Proposto | raw-git-tests-memory-mapa.md:15 |
| P22 | Story packages = "EP-14" (raw-git file wording) | `00-index.md` lists EP-14 as "Estado das telas"; the package/worktree code is in `tools/lib/opencode-package/`. Epic label unverified. | Desconhecido | docs/harness-evolution/00-index.md:43 |

## 5. The seven questions of 07-PROMPT-REVISAO-CRUZADA.md

1. Implemented Scrum and persisted artifacts. [Fact] Stories, sprints, epics, 12 lanes, lane order/config, transition and impediment history, status mapping, Jira override entries; one file `projects/<slug>/scrum.json` (schema v2, migration with backup). 13 POST/GET routes under `/api/project/<slug>/scrum*` (`ui/server/router.js:114-126`). 11 test files under `tests/` run by `npm test` = `node --test "tests/*.test.js"` (package.json:23). Not implemented: drafts, sprint history, close/carry-over, actors, links to sessions/commits. Evidence: raw-scrum-core.md.
2. Path executing feature-delivery in DAI. [Fact] None as code. Execution = a Claude Code session loading `sdlc-pipeline` skill, one stage per request, state in `_status.md` (DAI:SKILL.md:21,45-74). Only `feature-delivery` (active v1.3.0) is real definition; `product-delivery` is the draft with no adapter. The Harness engine is the only code that runs stages, keeping runs in memory; whether its runner really launches agents is Desconhecido (raw-harness-sprint-workflow.md:26). Note the ADR-TEL-003 statement that the runner never launches an engine (docs/harness-telemetria/adr/ADR-TEL-003-correlation.md:20) predates this check; treat as [Hypothesis] still valid.
3. Demand to story to sprint without history loss. [Fact] Today: no demand entity; a story is created by `POST /scrum/story` and defaults into the active sprint (sanitize.js:39); sprint assignment overwrites `sprintId` with no history (ops.js:100-107). So history IS lost for sprint moves; lane moves keep `transitionHistory` without actor. Gap and proposal: 04-ARQUITETURA-PROPOSTA.md s3 and 05-DECISOES s6.
4. What prevents two agents modifying one story. [Fact] Lane move: origin-lane check returns 409 (transitions.js:34-38). Everything else (edit, assign-sprint, impediment): last write wins; `scrum.json` write is atomic but read-modify-write without lock can lose updates across processes (migration.js:68-83). Agent level: ledger claim/lease (120 min) keyed by storyId exists but is not initialized here and not consulted by Scrum (reducer.js:50-64). No hook enforces claim before edit (.claude/settings.json).
5. Evidence and gates not being false agent claims. [Fact] Today they can be false: gates are text (raw-harness-sprint-workflow.md:24), test-execution service runs `node --test` with allow-list but result persistence is Desconhecido (svc/audit/test-execution.service.js:1-30), approvals have free-text actor, DAI gates are prompt judged (DAI:manifest.yaml:319-397). Event ingest rejects `trust=declared` and stamps `ingestedAt` server side (event-ingest.js:72,83), which is the right primitive. Proposal: 04 s7.
6. Multi-engine without duplicating specialists. [Fact] DAI export produces per-engine skills/agents from one source (`.agents/`, `skills/`), lossy for hooks and delegation (raw-dai-stories-gates.md:33-36). Harness engines: `tools/lib/engines/{claude,codex,index}.js`, opencode v2, 9router (raw-agents-coordination.md:13). Harness hardcodes a stage copy (duplication today). Proposal: single definition source plus drift check, 04 s6 and s8.
7. Absolutely necessary for MVP without broad refactor. [Hypothesis] (a) story-level `maturity` + explicit `sprintId:null` for drafts; (b) `sprintHistory[]` in scrum.json; (c) new `trace.*` event types plus `story_id`/`implementation_id` columns (additive migration) and a retention exemption; (d) `storyId` on workflow runs and chat runs; (e) verified commit SHA evidence collector; (f) pending-link list; (g) read-only timeline in story drawer. No lane changes, no new pipeline, no auth in MVP. Detail: 04 s11 and 05 s6.

## 6. Unknowns carried forward
- Whether the orchestration runner launches agents (adapters not inspected). [Pending decision] spike.
- Whether `test-execution.service` persists results; `evidence-detection.js` not read.
- Default `laneId` of a newly created story (`legacyStatusToLane` of default status not read).
- Server bind address and any network exposure (matters for the actor/auth model).
- Native session ID formats per engine; opencode-delegate capture.
- DAI: WORKFLOW.md bodies, `validate_all.py` result, `rules/max-file-size-modularity.md`, whether export really injects `workflows/global`.
- Epic UI; `controllers/permissions.controller.js` (exists, not read).

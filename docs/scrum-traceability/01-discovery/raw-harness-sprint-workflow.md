# Raw discovery: sprint model, workflow engine, approvals, identity (Harness)

Read-only subagent report, 2026-10-31, worktree a89703c. Paths relative to ui/server/. Several line numbers are approximate; verify before citing.

## Product Backlog vs Sprint Backlog
- A story is in the backlog when `sprintId` is falsy: services/project-scrum-persist.js:41-42 (`sprintStories` vs `backlogStories`).
- sanitizeStory (project-scrum-sanitize.js:30-39): sprintId is string or null, defaulting to activeSprintId when absent. New local stories (project-scrum-ops.js:61) therefore land in the active sprint by default. Defaults seed has `sprintId: null` (project-scrum-defaults.js:135).
- No "draft" or "demand" concept. Story status is only todo/in_progress/review/done (sanitize.js:4-10) plus laneId.
- assignStorySprint (project-scrum-ops.js:100-107) sets `entry.sprintId = sprintId || null` and updatedAt only. It writes no history, actor or previous sprint. Route: POST /api/project/:slug/scrum/story/assign-sprint (router.js:119, controllers/scrum.controller.js:107-122). For Jira stories it first creates a local override via localEntry.
- Sprint entry/exit history and carry-over: Absent. Only transitionHistory and impedimentHistory exist.
- Sprint fields (upsertSprint, ops.js ~165-178): id, name, goal, startDate, endDate, status (default "active"). No close/complete operation; no automatic move of unfinished stories.
- activeSprintId: set when payload.makeActive or when empty (ops.js:177); persist.js:35 falls back to first sprint; resolver (project-scrum-resolver.js:86-88): a local activeSprintId wins only when no Jira sprints exist, otherwise the current Jira sprint wins.

## Epics
- Model {id, title, description, color} (upsertEpic, ops.js ~155); no status/order/dates. Link via story.epicId (sanitize.js:38). Jira stories get epicId only when the epic key matches (project-scrum-jira-source.js:62). Epic UI: Unknown.

## Workflow engine already in the harness (services/orchestration/)
- Stages (agent-stage-definitions.js:60-175): start, story, bdd, prototype, modeling, dev, tests, review, commit-pr, deploy. Header says source of truth is `dai/workflows/feature-delivery/WORKFLOW.md`. Each stage has executors, agents (17 DAI agents plus builtin code-review), skills, a text `gate`, and `writes` (e.g. `_status.md`, `01-story.md`).
- Workflows (workflow-definitions.js:17-31): `feature-delivery` (all stages) and `hotfix` (start, dev, tests, review, commit-pr, deploy). WRITE_STAGES = dev, tests, commit-pr, deploy; APPROVAL_STAGES = prototype, commit-pr, deploy; mode "local" (:7-12). Permissions per stage {read, write, exec} + requiresApproval (:36-41).
- Run store (workflow-run-store.js:1-50): in-memory Map (MAX_RUNS 200) + idempotency map; snapshot fields executionId, slug, workflowId, routineId, laneId, actor, status, stageState[]. Lost on restart.
- Attempts (workflow-attempt.service.js): per stage attemptNo, attemptId `att-<uuid>`, in memory.
- Durable trace: workflow-event-bridge.js persists to the SQLite event store (persisted/duplicated/failed counters); persistence failures never break the workflow.
- Approvals (workflow-approval.service.js:33-120): approveWorkflowRun(executionId, {stageId, decision, actor, note}); actor is a free-text string trimmed to 80 chars (controllers/orchestration-approvals.controller.js:33), no authentication. Routine approvalPolicy approver is empty and unenforced (routine-definitions.js:19).
- Quality gates: text only per stage; no executable checker wired (separate atelier-quality.service.js and tools/lib/hia/quality-gate.js are not tied to stages).
- Nothing under ui/server reads docs/features/<slug>/_status.md (only `writes: ["_status.md"]` metadata, agent-stage-definitions.js:67).
- DAI link: skills via listProjectSkills(slug) (workflow-plan.service.js:23-31); design-agents.config.js:4 maps `.agents/`. Adapters: claude, gemini, opencode, services (not inspected whether the runner really executes agents).

## Lane bindings
- skill-bindings.service.js: `projects/<slug>/skill-bindings.json` {version 1, items {laneId: ["targetId:skillName"]}}, max 12 lanes x 20 skills. Configuration only.
- buildWorkflowPlan (workflow-plan.service.js:49-80) resolves stage skills; reports available/missing/unbound/approvalsRequired. Moving a story between lanes does not call the runner. Runs start only via the workflow-runs controller or routine-runner.service.js:100 (startWorkflowRun).

## Specialists, identity, Jira
- `.claude/agents` does not exist. DAI agent list hardcoded in agent-stage-definitions.js:6-24. No code-level autonomy field (levels 0-4 exist only as a skill concept). controllers/permissions.controller.js exists, not read.
- No RBAC, user identity or session user in ui/server; only free-text `actor`.
- Jira: snapshot read-only, stories source "jira-snapshot", sprintId = current Jira sprint (project-scrum-jira-source.js:75), ids `jira-<id>`. Local assignment creates an override; resolver uses `source.sprintId ?? localStory.sprintId` (resolver.js:35,54), so the Jira sprint wins. No HTTP write calls found in the Jira modules.

## Status table
| Item | Status |
|---|---|
| Backlog vs sprint (sprintId null) | Existing |
| Sprint fields | Existing |
| Sprint close / carry-over | Absent |
| Sprint entry/exit history | Absent |
| Draft/demand concept | Absent |
| Epic model + epicId | Existing (minimal) |
| Epic UI | Unknown |
| Workflow engine with DAI stages | Existing |
| Run/attempt persistence | Partial (in-memory; events go to SQLite) |
| Approvals | Partial (free-text actor) |
| Executable quality gate | Absent |
| Lane-to-skill bindings | Existing (config only) |
| Lane-to-workflow auto-trigger | Absent |
| Reads _status.md | Absent |
| RBAC / user identity | Absent |
| Jira write-back | Absent |

# Raw discovery: Scrum core

Read-only subagent report, 2026-10-31, against a89703c. S = ui/server, P = ui/public.

## Key facts
- Persistence: one JSON file per project `projects/<slug>/scrum.json` (S/services/project-scrum-persist.js:15,81). No SQLite. Top-level keys whitelisted in saveProjectScrum (persist.js:78-100): schemaVersion, migrationHistory, activeSprintId, sprints, epics, stories, lanes, lanesRevision, transitionHistory, impedimentHistory, statusMapping, deletedSourceKeys. New keys are silently dropped unless added to that whitelist; sanitizeStory (project-scrum-sanitize.js:27-43) is also a whitelist.
- Local story fields: id, key, title, description, acceptanceCriteria, epicId, sprintId, status (legacy), points, priority, assignee, updatedAt, plus laneId, origin "local" (ops.js:61-67), impediment.
- Jira stories: only a local override entry {id, key, sourceKey, sprintId, status, laneId, localOverrides, impediment} (ops.js:20-31, 48-58), composed by project-scrum-resolver.js with the Jira snapshot (project-scrum-jira-source.js) and doc stories (project-scrum-doc-source.js).
- IDs are ad hoc: `story.id || story.key || "us-" + Date.now() + "-" + rand` (sanitize.js:29); Jira id = key lowercased (jira-source.js:51). No central generator.
- PREMISE CORRECTION, lanes: 12 canonical ids (S/services/project-scrum-lanes.js:4-15): backlog, discovery, refinamento, pronto-para-dev, em-desenvolvimento, em-revisao, pronto-para-testes, em-testes, pronto-para-homologacao, em-homologacao, pronto-para-deploy, concluido. Names, visibility, active flag and order are configurable; ids are fixed. There is no "Impedimento" lane: impediment is a story flag.
- Transitions: no matrix; adjacent-only by canonical index, both lanes active (project-scrum-transitions.js:44-47). Client sends fromLaneId; mismatch gives SCRUM_STORY_CONFLICT, HTTP 409 with currentLaneId (transitions.js:34-38, scrum-transition.controller.js:30-33).
- No actor, role, permission, approval or auth in the Scrum controllers.
- lanesRevision exists (persist.js:31) but only guards lane configuration (ops.js:166-196, SCRUM_LANES_CONFLICT 409). Story edits, sprint assignment and impediments have no revision.
- Writes: writeJsonAtomic temp + rename (project-scrum-migration.js:68-83), no lock; read-modify-write can lose updates across processes.
- transitionHistory[] appended in moveStoryToLane (ops.js:91-105); record (transitions.js:51-62): id `<storyId>:<occurredAt>:<toLane>`, storyId, storyKey, fromLaneId, toLaneId, fromStatus, toStatus, occurredAt, storySource. No actor, reason, correlation or session.
- Impediment {active, reason, since, resolvedAt} (ops.js:121-123); impedimentHistory[] (ops.js:126-137); no actor.
- API (S/router.js:114-126) under /api/project/<slug>: GET /scrum; POST /scrum/jira-sync, /scrum/story, /scrum/story/status (legacy), /scrum/story/transition {storyId, fromLaneId, toLaneId}, /scrum/story/assign-sprint, /scrum/story/impediment, /scrum/story/delete, /scrum/epic, /scrum/sprint, /scrum/status-mapping, /scrum/lanes, /scrum/lanes/order (expectedRevision).
- UI: P/js/modules/design-scrum*.js (facade, view, store, state, data, backlog, sprint, story-card, story-drawer with history, story-modal, story-transition, lane-config, lane-order, filters, metrics, actions, jira-sync, status-mapping); CSS ui/public/css/design/09-13-scrum-*.css.
- Migration: project-scrum-migration.js, schema v2 (`scrum-status-v1-to-v2`), backup scrum.v1.backup.json, rollbackScrumFile, idempotent, rejects schema above 2.
- Tests: tests/project-scrum-{sources,migration,lanes,lane-order,transitions}, scrum-impediments-metrics, design-scrum-{lane-order,transitions,details}, design-screen-state, project-selection. `npm test` = node --test "tests/*.test.js" (package.json:23).
- No story link to chat, session, agent, commit, branch, file or evidence. Jira is a read-only snapshot, no write-back. Weak couplings: screen-state selectedStory (S/services/screen-state/registry.js:65-66), lane-to-skill bindings (skill-bindings.service.js:130), lane-to-workflow plan (orchestration/workflow-plan.service.js:49-55).
- Isolation: per directory, slug regex [\w-]+. Jira snapshot and doc stories are read from repoRoot, so two projects sharing a repo share those sources (possible leakage, not fully traced in the resolver).

## Matrix
| Item | Status | Evidence |
|---|---|---|
| Story persistence | Existing (JSON per project) | project-scrum-persist.js:15,81 |
| Story ID generator | Partial (ad hoc) | project-scrum-sanitize.js:29 |
| 12 lanes with the premise's names | Absent (12 different lanes) | project-scrum-lanes.js:4-15 |
| Impedimento lane | Absent (story flag) | project-scrum-ops.js:121-123 |
| Transition rules | Partial (adjacent-only) | project-scrum-transitions.js:44-47 |
| Permissions / approval / actor | Absent | scrum-transition.controller.js |
| lanesRevision | Existing (lane config only) | project-scrum-ops.js:166-196 |
| Story-move optimistic check | Existing (origin lane, 409) | project-scrum-transitions.js:34-38 |
| Atomic write | Existing (no lock) | project-scrum-migration.js:68-83 |
| Transition history | Partial (no actor or correlation) | project-scrum-transitions.js:51-62 |
| Impediment history | Existing (no actor) | project-scrum-ops.js:108-140 |
| HTTP API | Existing (13 routes) | router.js:114-126 |
| Migration with backup and rollback | Existing | project-scrum-migration.js |
| Tests | Existing (11 files) | tests/, package.json:23 |
| Story link to session, commit, evidence | Absent | grep |
| Jira link | Existing (read-only) | project-scrum-jira-source.js |
| Project isolation | Existing local; Partial for shared repoRoot sources | router.js:114, persist.js:65-66 |

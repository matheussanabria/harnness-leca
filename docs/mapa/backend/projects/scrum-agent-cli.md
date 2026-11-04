---
domain: backend
module: projects
feature: scrum-agent-cli
summary: Scrum CRUD CLI for agents and scripts over the existing scrum services, with a recorded actor and human-only approvals.
paths: [tools/scrum.js, tools/lib/scrum-cli/*.js, ui/server/services/project-scrum-actor.js, tests/scrum-cli.test.js, tests/project-scrum-sprints.test.js, tests/scrum-sprint-http.test.js]
keywords: [scrum, cli, agent, actor, crud, story, transition, guard]
updated: 2026-11-04
---
# Scrum CLI for agents

Same services as the HTTP API (`projects-scrum.md`); the store is `scrum.json` today and moves behind `HARNESS_SCRUM_STORE` with EP-17 story 17.07(b).

| File | Responsibility |
|---|---|
| `tools/scrum.js` | Entry: `story list\|get\|capture\|update\|link\|move\|maturity`, `epic list`; JSON out; exit 0 ok, 1 error, 2 usage, 3 needs a human. |
| `tools/lib/scrum-cli/context.js` | Resolves slug (`--project` or `projects/.active`), project folder and code repo like the server. |
| `tools/lib/scrum-cli/commands.js` | Command handlers over `project-scrum.service` and `project-scrum-capture`; update accepts content fields only. |
| `tools/lib/scrum-cli/sprint-commands.js` | `sprint list\|create\|plan\|start\|close`; agents may create and plan, start and close need a human actor (`--carry-over backlog\|next`, `--next <id>`). |
| `tools/lib/scrum-cli/guard.js` | Requires `--actor` on writes; agents cannot mark `ready` or move into `pronto-para-deploy` or `concluido`. |
| `ui/server/services/project-scrum-actor.js` | Validates `human:<id>` / `agent:<engine>:<run>` (stored as `actor` on transitions) and `normalizeLedgerId` for the story `ledgerId` field. |
| `tests/project-scrum-sprints.test.js`, `tests/scrum-sprint-http.test.js` | Lifecycle rules, merge-safe `upsertSprint`, summary and velocity, 409 on a second running sprint, CLI actor rules. |
| `tests/scrum-cli.test.js` | End to end on a temp projects folder: actor rules, draft capture, duplicates, agent limits, recorded actor. |

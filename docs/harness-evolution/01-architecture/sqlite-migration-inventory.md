---
tags: [harness-evolution, arquitetura, sqlite, inventario]
atualizado: 2026-11-01
epico: EP-17
---

# SQLite migration: persistence inventory (2026-11-01)

Baseline for [EP-17](../02-epics/EP-17-sqlite-persistencia/README.md). Evidence is `path:line`, spot-checked on 2026-11-01. Not exhaustive: story 17.13 re-runs the inventory at closing.

The server is a raw `http.createServer` (`ui/server.js:9`) with a regex route table, not Express. `projects/` and `global/` live under ROOT (`HARNESS_PROJECTS_DIR` override, `ui/server/config.js:44`).

## 1. Triggering incident

On 2026-11-01 a Ctrl+F5 in the Studio/Atelier chat created a new OpenCode session instead of resuming the previous one: two sessions with the same title were saved four minutes apart (`ses_e6811a9c...` at 16:27 and `ses_e68057437...` at 16:39 UTC). The engine session id lives only in `localStorage` key `harness:engine-sessions:v1` (`ui/public/js/modules/chat-session-store.js:8,43`). Root cause is not yet confirmed; story 17.02 reproduces it first.

## 2. Browser storage

| Key | Store | Evidence | Content | Target |
|---|---|---|---|---|
| `harness:engine-sessions:v1` | localStorage | `chat-session-store.js:8,43` | per-engine session ids | server (17.02) |
| `harness_active_chat_<slug\|global>` | localStorage | `shared/state.js:181-211` | chat draft and turns | server (17.02) |
| `leca.screen-state.v1:...` | localStorage | `shared/screen-state.js:8,37` | offline fallback of screen state | cache only (17.03) |
| `harness_active_project` | localStorage | `shared/project-selection.js:5,108` | active project slug | server user preference (17.04) |
| `harness_pin` | localStorage + cookie | `app.js:80`, `router.js:225` | shared remote PIN | replaced by sessions (17.04) |
| `dai_office_scene_preferences` | localStorage | `office/scene-preferences.js:19` | 3D scene prefs | stays local (device preference) |
| `hia_tokens_saved` | sessionStorage | `chat-hia-feedback.js:4,41` | session counter | stays local |

## 3. Server and tool files

| Path | Format | Stores | Atomic write | Target story |
|---|---|---|---|---|
| `projects/<slug>/chats/*.md` | MD | chat transcripts | partial | 17.02 (DB), 17.11 (MD export) |
| `projects/<slug>/ui-state/<screen>.json` + `.history.jsonl` | JSON/JSONL | screen state, 500-action ring, `rev` | yes | 17.03 |
| `projects/<slug>/scrum.json` | JSON | backlog, sprints, lanes | unconfirmed | 17.07 |
| `projects/<slug>/{app.json,mcp.json}` | JSON | project registry/config | no | 17.07 |
| `projects/<slug>/permissions.json` | JSON | permission allow rules | no | 17.07, 17.06 |
| `global/deploy*.json`, `deploy-authorizations.json` | JSON | deploy config, approvals | partial | 17.07 |
| `global/deploy-actions.jsonl`, `deploy-pipeline-runs.jsonl`, `deploy-health-runs.jsonl` | JSONL | deploy runs | append | 17.09 |
| `logs/telemetry/hia-executions.jsonl`, `runtime-shadow.jsonl` | JSONL | telemetry | append | 17.09 |
| `.../prototypes/<id>/proto.json`, journal, `scratch/` | JSON | Atelier metadata and history | partly | 17.08 |
| `.../prototypes/<id>/screens/*.html`, `styles/*.css` | HTML/CSS | Atelier source | n/a | stays on disk (ADR-012) |
| `projects/<slug>/coordination/events.sqlite` | SQLite WAL | event log, `user_version` 1 | n/a | 17.10 |
| `projects/<slug>/coordination/state.json`, `events/`, `inbox/` | JSON | multi-agent ledger (ADR-007) | yes + `.lock` | stays (re-evaluated in 17.13) |
| `projects/<slug>/memory/**`, `global/memory/**` | MD + frontmatter | curated memory (ADR-009) | tmp+rename | stays on disk |
| `projects/<slug>/{instructions.md,memory.md}`, `context/` | MD | instructions, reference files | n/a | stays on disk |
| `projects/<slug>/extraction-state.json`, `memory-review.json`, `groups.json` | JSON | importer and review state | no | 17.07 |
| canvas boards/assets (`services/canvas/`) | JSON + files | Canvas | yes | 17.08 |
| `projects/<slug>/routines` state | JSON | routines | no | 17.07 |
| session registry (`canonical-sessions/session-registry.service.js:28`) | JSON | canonical sessions | fixed `.tmp` name | 17.10 |

## 4. Existing SQLite

`events.sqlite` per project (`events/event-store.js:16`): `node:sqlite` `DatabaseSync`, WAL, `busy_timeout=5000`, table `events` (seq, id UNIQUE, type, at, source, trust, project/session/execution ids, payload), `PRAGMA user_version = 1`. Retention (`event-retention.js:19-25`): 20000 operational events, usage events 180 days / 200000 rows. External read-only databases: `opencode.db`, Codex `state_5.sqlite`.

## 5. Identity, approval and audit today

| Mechanism | Evidence | Gap |
|---|---|---|
| One shared PIN, remote access only | `config.js:13`, `tools/lib/network-access.js:71-75` | no users, no roles |
| Tool permission gate | `permissions.controller.js:9-26`, `tools/lib/permissions.js` | rules in an unlocked JSON file |
| Deploy authorize/execute | `deploy/authorization.service.js:8`, `deploy-actions.service.js:84-143` | `actor` is a client-supplied string |
| Workflow approvals | `orchestration.routes.js:51` | approver not authenticated |
| Event store as trail | `event-store.js` | no authenticated actor; pruning can delete rows |

## 6. Audit surface (mutating routes)

About 89 POST plus PUT/DELETE/PATCH routes, defined in `ui/server/router.js:117-206` and `ui/server/routes/*.routes.js`: Scrum 12, project and sync about 17, chat and permissions 6, deploy 10, Design/Atelier about 25, inspect 3, artifacts 3, audit 4, orchestration 6, events and attention 3, sessions 2, screens 3, canvas 4, skill bindings 1, active project 1. Several execute commands or write outside ROOT (deploy trigger, services start, `source/file`, `agent-run`, audit evidence execute). Whether the PIN check covers every mutating route is unverified; story 17.05 starts by testing that.

## 7. Risks of the current formats

1. Non-atomic writes: `tools/lib/state.js:51`, `routines.js:105`, `permissions.js:94`, `atelier-tools.service.js:146,193,210`, `prototype-storage.service.js:81-84`.
2. No locking outside coordination: concurrent read-modify-write on `scrum.json`, `proto.json`, `permissions.json`, `deploy-*.json`.
3. JSONL logs grow without rotation and have no tamper evidence.
4. Temp-name collisions: `session-registry.service.js:69` (fixed `.tmp`), `memory/store.js:122` (`Date.now()` only).
5. Coordination `.lock` takes over after 5 minutes and can break a live long operation.
6. Two sources of truth: browser fallbacks versus server files.
7. `actor` is self-asserted everywhere.
8. `events.sqlite` retention would delete audit rows if audit lived there.

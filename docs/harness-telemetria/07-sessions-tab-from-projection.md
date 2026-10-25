# Sessions tab fed by the EP-09 projection (story T2.5)

Status: plan, 2026-10-24. Branch `feat/sessions-from-projection`, worktree `C:/Temp/hl-sessions`.

## Problem (verified on a live server)
- The Central "Sessoes" tab reads `GET /api/project/:slug/sessions` (canonical registry, Markdown discovery) and shows 0 sessions.
- `GET /api/project/:slug/projections` has 81 sessions: external Claude Code / OpenCode sessions with `origin`, `activity`, `presence`, `lastActivityAt`, plus Harness chats, plus ~50 entries with no provider and no origin.
- The ~50 empty entries are suspected to be created by `usage.observed` events (they carry a `sessionId`, so the projector makes a session view for each). Unconfirmed: prove it first.

## Goal
One list of sessions, same story as the office: Markdown chats (canonical registry) + external sessions + Harness chat runs, deduplicated, with engine, activity, presence, origin and last activity. No empty phantom rows.

## Steps
1. Prove the cause of the empty sessions (query the projection of a store seeded with usage events). If confirmed, the projector must not create or update session views from `usage.observed`; keep the usage events queryable. Tests, additive only, frozen read contract unchanged.
2. Read model: in `session-registry-orchestrator.service.js` (the Central read model), merge projection sessions into the list. Map: id, title (engine + short native id when no title), engine/provider, executionStatus, activity, presence, origin, lastActivityAt, link state (`inferred` for scanner sessions), attention. Deduplicate against Markdown-discovered sessions by native session id / fingerprint through the existing reconciler order (exact, explicit metadata, inferred candidate, no link). Never invent a link: unknown stays unknown.
3. Filters (Motor, Execucao, Workflow, Atencao, Vinculo) and the totals line ("N sessoes, M com atencao, K com vinculo inferido") must count the merged list.
4. UI (`ui/public/js/modules/central-sessions-*.js`): show activity and presence next to the execution status, an "externa" / "chat do Harness" origin label, and "ultima atividade". Lista and Kanban views both. FontAwesome icons only, no emojis, Portuguese UI text. Empty and error states unchanged.
5. Tests: projector ignores usage events for session views; merged read model (external + markdown + chat) with dedup; filters and totals; UI rendering with the existing fake-DOM approach; frozen contract tests untouched and green.
6. Update `docs/mapa/16-telemetry-program.md` (and the canonical-sessions rows if they live in `docs/mapa/13-...`) for every new or changed file.

## Constraints
Work only in `C:/Temp/hl-sessions`. Do not commit (the commit hook inspects the branch of the shell's start folder; the user commits). Guarded tests only: `timeout 400 node --test --test-timeout=120000 "tests/*.test.js"`, `npm run check`. Close sqlite stores (`closeStore(slug)`) before removing temp dirs in tests. Every file under 250 lines. English code and comments, Portuguese UI strings.

## Out of scope
Per-skill and per-workflow metrics, Codex/Antigravity usage, kanban redesign.

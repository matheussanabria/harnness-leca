---
domain: tools
module: engines
feature: engines
summary: AI engine registry and clients (claude, gemini, codex, opencode), autostart, DAI, monitor and tests.
paths: [tools/lib/engines/*.js, tools/lib/antigravity-bin.js, tools/lib/opencode-v2*.js, tools/lib/engine-autostart.js, tests/opencode-v2*.test.js, tests/antigravity-bridge.test.js]
keywords: [engine, opencode, codex, claude, gemini, antigravity, autostart, monitor, dai, 9router]
updated: 2026-11-03
---
# Engines

| File | Responsibility |
|---|---|
| `tools/lib/engines/index.js` | Unified engine registry (`claude`, `gemini`, `opencode`); all follow the `{ id, stream, status }` interface. |
| `tools/lib/antigravity-bin.js` | Resolves the Antigravity CLI executable (`agy` / `agy.exe`) from AGY_BIN, default installation or PATH. |
| `tools/lib/engines/antigravity-stream.js` | Streaming NDJSON executor for Antigravity CLI, preserving multi-turn sessions and token usage. |
| `tools/lib/engines/gemini.js` | Gemini/Antigravity engine: runs native Antigravity CLI with subscription, falling back to Google AI Studio. |
| `tools/lib/engines/opencode-model.js` | Converts a model id (`provider/model`, e.g. `9router/Harness`) into `{providerID, modelID}`; no prefix means built-in `opencode`. |
| `tools/lib/engines/codex.js` | Integrates the local Codex CLI, with session resume, model and reasoning effort. |
| `tools/lib/opencode-v2.js` | Client for the opencode v2 HTTP API (`/api/*`, Basic auth): session, prompt, turn summary, interrupt, model list. |
| `tools/lib/opencode-v2-turn.js` | One streaming turn on opencode v2: `/api/event` deltas, `/message` fallback, active-session idle handling, abort via interrupt. |
| `tools/start-opencode.js` | `npm run opencode`; starts `opencode serve --port 63186` with the shared OPENCODE_SERVER_PASSWORD from `global/.env`. |
| `tools/lib/engine-autostart.js` | On UI boot starts 9router (:20128) and opencode (:63186) if down; `HARNESS_AUTOSTART=0` disables, `OPENCODE_BIN` overrides; never throws. |
| `tools/lib/claude-sync-sources.js` | Reconciles duplicate Claude sessions across workspaces and picks a deterministic source before sync. |
| `tools/lib/dai.js` | Integration with the DAI squad (17 specialist agents) and workflows. |
| `tools/lib/engine-monitor/` | Engine monitor and activity states (EP-09.06): presence, state machine with dwell time and decay, deterministic classifier. |
| `ui/public/js/modules/session-capability-resolver.js`, `central-session-actions.js`, `central-live.js`, `central-action-dispatcher.js` | Navigation, actions, session resume and live SSE stream in the Sessions Center (EP-09.04). |
| `ui/server/services/attention-queue.service.js`, `ui/server/controllers/central-attention.controller.js`, `ui/public/js/modules/attention-notifier.js` | Attention queue and priority notifications of the Sessions Center (EP-09.05). |
| `tests/antigravity-bridge.test.js` | Antigravity CLI resolution, stream parser, session tracking and error handling tests. |
| `tests/opencode-v2-turn.test.js` | Streaming turn against a fake SSE server (deltas, failure, silence, SSE down, abort). |
| `tests/opencode-v2.test.js` | v2 client against a fake HTTP server with password (routes, bodies, turn summary, model list, API errors). |
| `tests/engine-autostart.test.js` | Autostart with a fake HTTP server (already up, disabled, missing binary) and the "OpenCode desligado" message for `fetch failed`. |
| `tests/engine-monitor-*.test.js` | Engine monitor presence, state machine and classifier. |
| `tests/central-session-actions.test.js` | Sessions Center actions. |
| `tests/central-live.test.js` | Sessions Center live stream. |
| `tests/central-attention.test.js` | Attention queue service. |
| `tests/central-attention-http.test.js` | Attention queue HTTP endpoints. |

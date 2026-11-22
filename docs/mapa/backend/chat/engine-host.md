---
domain: backend
module: chat
feature: engine-host
summary: Engine host process (EP-23.03): engine CLIs outside the restartable web server, loopback API with token, web relay.
paths: [ui/engine-host.js, ui/server/services/engine-host/*.js, ui/server/services/engine-host-client.js, tests/engine-host.test.js, tests/engine-host-drain.test.js, tests/fixtures/engine-host-fake.js]
keywords: [engine, host, process, relay, sse, token, autostart, restart, ep-23]
updated: 2026-11-21
---
# Engine host

The engine CLIs run in `ui/engine-host.js`, a long-lived process on `127.0.0.1:4322` that owns the run registry and the `chat_runs*` tables. The web server relays `POST /api/chat`, the attach, the stop and the permission answers to it, and starts it detached when it is down. `HARNESS_ENGINE_HOST=0` is the legacy in-process mode.

| File | Responsibility |
|---|---|
| `ui/engine-host.js` | Host bootstrap: loopback listener, token, `--stop`, `--restart`, crash guards, detached respawn after a drain; `npm run host`, `host:stop`, `host:restart`. |
| `ui/server/services/engine-host/host-routes.js` | Host API: `/health`, `/runs` (start, list), `/runs/:id/attach`, `/runs/:id/stop`, `/permissions/answer`, `/admin/restart` (drain, force, cancel), `/shutdown` (token); `POST /runs` answers 503 `host-restarting` while draining, and the loopback-only `/api/permissions/request` for the Claude permission tool. |
| `ui/server/services/engine-host/run-starter.js` | Starts a chat run: validation, capacity, registry, permission cards, telemetry, HIA dispatch and the engine CLI. |
| `ui/server/services/engine-host/sse.js` | SSE headers and attach (live from memory or replayed from the run journal). |
| `ui/server/services/engine-host/drain.js` | EP-23.05 safe restart: draining state, wait for active runs up to `HARNESS_HOST_DRAIN_MS` (10 min), then force (runs end `interrupted`) or cancel. |
| `ui/server/services/engine-host/restart-cli.js` | `npm run host:restart`: starts the drain, prints progress, asks in the terminal before forcing past the limit. |
| `ui/server/services/engine-host/protocol.js` | Port, URL, token file, token check, protocol version and the host mode switch. |
| `ui/server/services/engine-host-client.js` | Web side: `/health` check, detached autostart with a 5 s wait, protocol check, request and SSE relay. |
| `tests/engine-host.test.js` | Web restart mid-answer, stop, token and proxy refusal, 503 and autostart, host writes only `chat_runs*`. |
| `tests/engine-host-drain.test.js` | Drain wait, limit, force and cancel; 503 while draining; CLI asks before forcing; composer keeps the refused text; banner text. |
| `tests/fixtures/engine-host-fake.js` | Preload for the host child in tests: fake engine and a write-statement recorder. |

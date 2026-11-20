---
domain: backend
module: chat
feature: engine-host
summary: Engine host process (EP-23.03): engine CLIs outside the restartable web server, loopback API with token, web relay.
paths: [ui/engine-host.js, ui/server/services/engine-host/*.js, ui/server/services/engine-host-client.js, tests/engine-host.test.js, tests/fixtures/engine-host-fake.js]
keywords: [engine, host, process, relay, sse, token, autostart, restart, ep-23]
updated: 2026-11-20
---
# Engine host

The engine CLIs run in `ui/engine-host.js`, a long-lived process on `127.0.0.1:4322` that owns the run registry and the `chat_runs*` tables. The web server relays `POST /api/chat`, the attach, the stop and the permission answers to it, and starts it detached when it is down. `HARNESS_ENGINE_HOST=0` is the legacy in-process mode.

| File | Responsibility |
|---|---|
| `ui/engine-host.js` | Host bootstrap: loopback listener, token, `--stop`, crash guards; `npm run host` / `npm run host:stop`. |
| `ui/server/services/engine-host/host-routes.js` | Host API: `/health`, `/runs` (start, list), `/runs/:id/attach`, `/runs/:id/stop`, `/permissions/answer`, `/shutdown` (token), and the loopback-only `/api/permissions/request` for the Claude permission tool. |
| `ui/server/services/engine-host/run-starter.js` | Starts a chat run: validation, capacity, registry, permission cards, telemetry, HIA dispatch and the engine CLI. |
| `ui/server/services/engine-host/sse.js` | SSE headers and attach (live from memory or replayed from the run journal). |
| `ui/server/services/engine-host/protocol.js` | Port, URL, token file, token check, protocol version and the host mode switch. |
| `ui/server/services/engine-host-client.js` | Web side: `/health` check, detached autostart with a 5 s wait, protocol check, request and SSE relay. |
| `tests/engine-host.test.js` | Web restart mid-answer, stop, token and proxy refusal, 503 and autostart, host writes only `chat_runs*`. |
| `tests/fixtures/engine-host-fake.js` | Preload for the host child in tests: fake engine and a write-statement recorder. |

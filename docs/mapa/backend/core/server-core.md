---
domain: backend
module: core
feature: server-core
summary: HTTP server entrypoint, config, main router, remote access, static files, Studio source and dev processes.
paths: [ui/server.js, ui/server/config.js, ui/server/router.js, ui/server/controllers/remote.controller.js, ui/server/controllers/static.controller.js, ui/server/controllers/source-workspace.controller.js, ui/server/services/source-workspace.service.js, ui/server/controllers/services.controller.js]
keywords: [server, router, config, pin, remote, static, source, processes]
updated: 2026-10-30
---
# Server Core

| File | Responsibility |
|---|---|
| `ui/server.js` | Creates the HTTP server (`createServer`), validates host/origin and enables the HMR proxy. |
| `ui/server/config.js` | Ports, remote PIN, response helper (`send`) and JSON body reader (`readJsonBody`). |
| `ui/server/router.js` | Regex/string route table and delegation to controllers. |
| `ui/server/controllers/remote.controller.js` | QR Code info, mobile PIN validation and local network details. |
| `ui/server/controllers/static.controller.js` | Safely serves HTML, CSS, JS and images inside `ui/public/`; the vendored DC runtime gets `Cross-Origin-Resource-Policy: cross-origin` for the opaque-origin iframe. |
| `ui/server/controllers/source-workspace.controller.js` and `ui/server/services/source-workspace.service.js` | Studio source list/read/save with path confinement, secret blocking and fingerprint conflicts. |
| `ui/server/controllers/services.controller.js` | Starts and stops local processes (Spring Boot, Vite) and streams their logs. |

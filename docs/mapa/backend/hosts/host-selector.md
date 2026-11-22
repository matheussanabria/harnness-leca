---
domain: backend
module: hosts
feature: host-selector
summary: Host selector (EP-23.06): saved Harness hosts (local, VPS) with their state, URL rules and a masked PIN.
paths: [ui/server/services/host-registry.js, ui/server/routes/hosts.routes.js, ui/public/js/shared/host-selector.js, tests/host-registry.test.js]
keywords: [host, vps, local, selector, tailscale, https, pin, ep-23]
updated: 2026-11-22
---
# Host selector

The header's Host button lists the Harness installs the user saved and opens one of them in the tab. Each host keeps its own database; nothing is copied between hosts. `data/hosts.json` holds name, URL and the remote access PIN, which only this server uses to read the other host's `/api/host/info`.

| File | Responsibility |
|---|---|
| `ui/server/services/host-registry.js` | Read/write `data/hosts.json` (0600), URL rules (HTTPS, or HTTP on loopback, private networks and Tailscale), PIN mask, state check of a host (online, offline, locked, incompatible). |
| `ui/server/routes/hosts.routes.js` | `GET /api/host/info` (name, version, protocol), `GET /api/hosts` (this host and the saved ones with state), `POST /api/hosts`, `POST /api/hosts/remove`. |
| `ui/public/js/shared/host-selector.js` | Header button and panel: state as icon and text, Abrir, Remover, add form; placed inside the viewport. |
| `tests/host-registry.test.js` | URL rules, PIN never returned whole, four host states through the real server, markup without emojis and escaped. |

---
domain: intelligence
module: hia
feature: dashboard
summary: HIA chat dispatcher (Script-First interception) and the metrics dashboard module and styles.
paths: [ui/server/services/hia-chat-dispatcher.service.js, ui/public/js/modules/hia-dashboard.js, ui/public/css/hia-dashboard.css]
keywords: [hia, dashboard, chat-dispatcher, metrics, script-first, css]
updated: 2026-10-31
---
# HIA Dispatcher and Dashboard

| File | Responsibility |
|---|---|
| `ui/server/services/hia-chat-dispatcher.service.js` | F7: chat dispatcher that intercepts deterministic automations (Script-First) before spending cloud quota; on the cloud route it records the suggested 9Router combo, project and a 120-char redacted prompt preview. |
| `ui/public/js/modules/hia-dashboard.js` | F7: module that aggregates the HIA metrics payload for the Harness frontend. |
| `ui/public/css/hia-dashboard.css` | F7: metrics panel styles using Harness design tokens, no emojis, FontAwesome icons. |

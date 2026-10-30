---
domain: frontend
module: window-manager
feature: windows
summary: Office windows and adapters on top of the Window Manager - chat window, stations, workspace menu, dialogs.
paths: [ui/public/js/office/office-chat-window.js, ui/public/js/office/office-wm-controller.js, ui/public/js/office/workspace-menu.js, ui/public/js/window-manager/station-adapter.js, ui/public/js/shared/*.js, ui/public/css/chat/07-continue-chat-modal.css, ui/public/css/office/19-workspace-menu.css]
keywords: [office, station, adapter, workspace, menu, unsaved, dialog, chat-window, drawer]
updated: 2026-10-30
---
# Office Windows and Adapters

| File | Responsibility |
|---|---|
| `ui/public/js/office/office-chat-window.js` | Reuses the Chat Center in a floating window to continue saved conversations. |
| `ui/public/css/chat/07-continue-chat-modal.css` | Responsive layout of the saved-conversation picker with fixed header and filters. |
| `ui/public/js/window-manager/station-adapter.js` | Connects 3D/2.5D office objects to the Window Manager, with drawer and floating window support. |
| `ui/public/js/shared/unsaved-dialog.js` | Turns `UNSAVED_CHANGES` blockers into a Save/Discard/Cancel decision. |
| `ui/public/js/shared/confirm-dialog.js` | Replaces `window.confirm` in Studio and Deploy. |
| `ui/public/js/office/office-wm-controller.js` | Starts the bootstrap, builds the workspace menu and guards project switch with the unsaved dialog. |
| `ui/public/js/office/workspace-menu.js` | HUD list of templates and project layouts; saves, loads and deletes custom layouts. |
| `ui/public/css/office/19-workspace-menu.css` | Styles of the workspace menu in the HUD. |

- Core manager, store and registry live in `core.md`.

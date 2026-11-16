---
domain: backend
module: chat
feature: claude-ai-import
summary: Import of a claude.ai data export (raw zips or extracted folder) from the CLI and from the "Importar claude.ai" dialog.
paths: [tools/import-claude-ai-chats.js, tools/lib/claude-ai-export.js, tools/lib/zip-read.js, ui/server/controllers/claude-ai-import.controller.js, ui/public/js/modules/claude-ai-import.js, ui/public/css/components/09-claude-ai-import.css, tests/claude-ai-import.test.js]
keywords: [claude.ai, export, import, zip, conversations, design_chats, chats, importar]
updated: 2026-11-16
---
# claude.ai export import

| File | Responsibility |
|---|---|
| `tools/import-claude-ai-chats.js` | CLI and `run()`/`loadItems()` that normalize claude.ai chats and Claude Design chats into `projects/<slug>/chats/*.md`; nothing is imported without `--match`, `--design-project` or `--id`. |
| `tools/lib/claude-ai-export.js` | Locates `conversations.json` and `design_chats/` in an extracted folder, a folder with the raw `conversations-NNN.zip`/`design_chats-NNN.zip`, or one of those zips; extracts zips once into an OS temp cache. |
| `tools/lib/zip-read.js` | Dependency-free zip reader (stored and deflate, no ZIP64) with a zip-slip guard. |
| `ui/server/controllers/claude-ai-import.controller.js` | `POST /api/claude-ai-import/list` (export contents plus the projects that already hold each chat) and `POST /api/project/:slug/claude-ai-import` (imports the picked ids). |
| `ui/public/js/modules/claude-ai-import.js` | "Importar claude.ai" dialog: export path (remembered per browser), filter, hide-imported toggle, multi-select and import into the active project. |
| `ui/public/css/components/09-claude-ai-import.css` | Styles of the import dialog (`.cai-*`). |
| `tests/claude-ai-import.test.js` | CP-01..CP-05 of `docs/features/claude-ai-export-import/02-bdd.feature`: zip reader, locator and both endpoints. |

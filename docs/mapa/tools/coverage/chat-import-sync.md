---
domain: tools
module: coverage
feature: chat-import-sync
summary: Chat import, normalization, synchronization and session export entry points.
paths: [tools/import-claude-code-chats.js, tools/import-codex-chats.js, tools/import-opencode-chats.js, tools/export-claude-sessions.js, tools/export-codex-sessions.js, tools/sync.js, tools/lib/chat-format.js, tools/lib/chat-save.js, tools/lib/chat-store.js, tools/lib/claude-sync-sources.js, tools/lib/gemini-bridge.js, tools/lib/sync-core.js, tools/lib/sync-codex.js, tests/sync-codex.test.js, tools/lib/state.js, tools/lib/redact.js]
keywords: [chat, import, sync, session, Claude, Codex, Gemini, opencode, redact]
updated: 2026-11-16
---
# Chat import and synchronization

| File | Responsibility |
|---|---|
| `tools/import-claude-code-chats.js` | EN: Imports Claude Code JSONL sessions as Harness Markdown chats. PT: Importa sessões JSONL do Claude Code como conversas Markdown do Harness. |
| `tools/import-codex-chats.js` | EN: Imports local Codex sessions into a project's chats. PT: Importa sessões locais do Codex para as conversas do projeto. |
| `tools/import-opencode-chats.js` | EN: Reads opencode's SQLite conversation store and imports chats. PT: Lê o banco SQLite do opencode e importa conversas. |
| `tools/export-claude-sessions.js` | EN: Converts Harness chats into resumable Claude Code JSONL sessions. PT: Converte conversas do Harness em sessões JSONL retomáveis no Claude Code. |
| `tools/export-codex-sessions.js` | EN: Converts Harness chats into local Codex session JSONL. PT: Converte conversas do Harness em sessões JSONL locais do Codex. |
| `tools/sync.js` | EN: CLI that runs importers and updates extraction state for existing projects. PT: CLI que executa importadores e atualiza o estado de extração dos projetos existentes. |
| `tools/lib/chat-format.js` | EN: Canonical parser and renderer for project chat Markdown. PT: Parser e renderizador canônico do Markdown de conversas. |
| `tools/lib/chat-save.js` | EN: Saves a conversation produced by the web UI in the shared chat format. PT: Salva conversas da interface web no formato comum. |
| `tools/lib/chat-store.js` | EN: Writes imported chat files, avoiding rewrites when content is unchanged. PT: Grava conversas importadas e evita regravações sem mudanças. |
| `tools/lib/claude-sync-sources.js` | EN: Selects one preferred source when Claude sessions are duplicated across workspaces. PT: Seleciona uma fonte preferencial quando sessões Claude se repetem entre workspaces. |
| `tools/lib/gemini-bridge.js` | EN: Bridges messages and local transcripts with the Antigravity IDE agent API. PT: Faz a ponte entre mensagens e transcrições locais do agente Antigravity. |
| `tools/lib/sync-core.js` | EN: Runs on-demand multi-engine chat synchronization for the UI and routines; exports the SYNC_ENGINES list (claude, gemini, opencode, codex). PT: Executa sincronização sob demanda de conversas para a interface e rotinas. |
| `tools/lib/sync-codex.js` | EN: Codex leg of the sync: maps session cwd to a project, reports unmatched sessions, imports per project. PT: Etapa do Codex no sync: associa o cwd da sessão ao projeto e importa. |
| `tests/sync-codex.test.js` | EN: Codex sync tests (cwd mapping, unmatched report, date, idempotency, engine list). PT: Testes do sync do Codex. |
| `tools/lib/state.js` | EN: Persists per-conversation extraction state and scans project chats. PT: Persiste o estado de extração por conversa e percorre os chats do projeto. |
| `tools/lib/redact.js` | EN: Heuristically redacts common secrets and personal identifiers from text. PT: Oculta heurísticamente segredos comuns e identificadores pessoais do texto. |

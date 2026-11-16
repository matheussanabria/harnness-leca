---
domain: tools
module: coverage
feature: orchestration-adapters
summary: Event Engine telemetry adapters for Claude, Gemini, OpenCode and local services.
paths: [ui/server/services/orchestration/adapters/claude-adapter.js, ui/server/services/orchestration/adapters/gemini-adapter.js, ui/server/services/orchestration/adapters/opencode-adapter.js, ui/server/services/orchestration/adapters/services-adapter.js]
keywords: [orchestration, adapters, telemetry, events, engines]
updated: 2026-11-16
---
# Orchestration Adapters / Adaptadores de Orquestração

| File | Responsibility |
|---|---|
| `ui/server/services/orchestration/adapters/claude-adapter.js` | Collects observed events and state from recent Claude Code sessions. / Coleta eventos e estado observados de sessões recentes do Claude Code. |
| `ui/server/services/orchestration/adapters/gemini-adapter.js` | Collects observed events and state from Gemini/Antigravity sessions. / Coleta eventos e estado observados de sessões Gemini/Antigravity. |
| `ui/server/services/orchestration/adapters/opencode-adapter.js` | Collects observed events and state from the OpenCode SQLite database. / Coleta eventos e estado observados do banco SQLite do OpenCode. |
| `ui/server/services/orchestration/adapters/services-adapter.js` | Converts managed local development process state to canonical events. / Converte estado de processos locais gerenciados em eventos canônicos. |

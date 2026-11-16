---
domain: tools
module: coverage
feature: runtime-foundation
summary: Runtime setup, engine executable discovery, project matching and shared CLI helpers.
paths: [tools/export-context.js, tools/start-opencode.js, tools/tunnel.js, tools/lib/bin.js, tools/lib/claude-bin.js, tools/lib/codex-bin.js, tools/lib/cli.js, tools/lib/dai.js, tools/lib/env.js, tools/lib/llm.js, tools/lib/projects.js, tools/lib/root.js, tools/lib/text.js, tools/lib/limits.js]
keywords: [runtime, engine, cli, environment, projects, context export, tunnel, DAI]
updated: 2026-11-16
---
# Runtime and engine foundation

| File | Responsibility |
|---|---|
| `tools/export-context.js` | EN: Exports curated project context to native Claude, Gemini and local agent targets. PT: Exporta o contexto revisado do projeto para destinos nativos do Claude, Gemini e agentes locais. |
| `tools/start-opencode.js` | EN: Starts the local opencode server used by the Harness UI. PT: Inicia o servidor local do opencode usado pela interface do Harness. |
| `tools/tunnel.js` | EN: Starts and manages an HTTPS tunnel for remote access to the local Harness. PT: Inicia e gerencia túnel HTTPS para acesso remoto ao Harness local. |
| `tools/lib/bin.js` | EN: Resolves engine executables to absolute paths for safe process launch. PT: Resolve executáveis de mecanismos para caminhos absolutos e execução segura. |
| `tools/lib/claude-bin.js` | EN: Resolves the Claude Code executable using configuration and PATH fallbacks. PT: Localiza o executável do Claude Code pela configuração e alternativas de PATH. |
| `tools/lib/codex-bin.js` | EN: Resolves the Codex executable using configuration and PATH fallbacks. PT: Localiza o executável do Codex pela configuração e alternativas de PATH. |
| `tools/lib/cli.js` | EN: Provides minimal argument parsing and shared CLI error/run helpers. PT: Fornece leitura mínima de argumentos e utilitários comuns para CLIs. |
| `tools/lib/dai.js` | EN: Reads DAI agents and skills for Harness integration. PT: Lê agentes e skills do DAI para integração com o Harness. |
| `tools/lib/env.js` | EN: Loads local environment files without overriding system environment values. PT: Carrega arquivos locais de ambiente sem sobrescrever valores do sistema. |
| `tools/lib/llm.js` | EN: Sends isolated single-turn prompts to configured Claude, opencode or Ollama engines. PT: Envia prompts isolados de turno único aos mecanismos Claude, opencode ou Ollama configurados. |
| `tools/lib/projects.js` | EN: Matches working-folder paths and aliases to existing Harness project slugs. PT: Associa caminhos de trabalho e aliases aos slugs de projetos existentes. |
| `tools/lib/root.js` | EN: Resolves the Harness root directory, with an override for isolated tests. PT: Resolve a raiz do Harness, com opção de substituição para testes isolados. |
| `tools/lib/text.js` | EN: Shared text helpers for safe slugs, clipping and output formatting. PT: Utilitários de texto para slugs seguros, truncamento e formatação. |
| `tools/lib/limits.js` | EN: Shared size limits for imported conversations and tool output. PT: Limites compartilhados de tamanho para conversas importadas e saídas de ferramentas. |

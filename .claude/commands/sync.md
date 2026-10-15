---
description: Atualiza as conversas dos 3 motores (Claude Code, Gemini/Antigravity, opencode) nos projetos do harness
argument-hint: "[--project slug] [--engine claude,gemini,opencode] [--dry-run] [--no-extract]"
allowed-tools: Bash(node tools/sync.js:*)
---

Rode `node tools/sync.js $ARGUMENTS` na raiz do harness e resuma o resultado em português:

1. Quantas conversas novas e atualizadas entraram, por motor e projeto (só cite o que mudou).
2. Quais pastas foram ignoradas por não terem projeto correspondente. Se alguma parecer pertencer a um projeto existente, sugira o apelido para `projects/.sources.json`, sem editar o arquivo.
3. O que ficou pendente de análise (colunas "novas" e "alteradas"), e que a análise com memórias e decisões é feita pela skill `extrair-artefatos` (ou `extract-artifacts.js --llm`, que gasta cota). Não rode a análise por conta própria.

Não crie projetos nem altere `memory.md` ou `instructions.md`.

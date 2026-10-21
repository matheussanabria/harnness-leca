# Épico 08 — Pipeline Local de Artefatos

## Visão Geral
A CLI de extração de artefatos passa a oferecer um motor local (`--engine ollama`), produzindo sugestões de memórias, regras e decisões a partir das conversas do projeto sem consumir cota de LLMs em nuvem.

## Histórias de Usuário
- [08.01](08.01-local-artifacts-cli.md): Extensão de extração local em `tools/extract-artifacts.js` com `--engine ollama`.

## Evidências de Implementação
- `tools/lib/llm.js` — `askOllama`.
- `tools/lib/runtime/ollama-cli.js` — runner síncrono do motor local.
- `tools/lib/runtime/ollama-client.js` — `generateText` (resposta em texto livre).
- `tests/runtime-ollama-engine.test.js` — testes do caminho local.

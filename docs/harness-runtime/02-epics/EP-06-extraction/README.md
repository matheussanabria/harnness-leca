# Épico 06 — Extração de Entidades e Memória

## Visão Geral
Extração estruturada de conhecimento (decisões, regras, termos de domínio e resumo) a partir de conversas e especificações técnicas, executada inteiramente em CPU local via Ollama, sem consumo de cota de LLMs em nuvem.

## Histórias de Usuário
- [06.01](06.01-extraction-schema.md): Contrato estrito de extração (decisões, regras, termos, resumo).
- [06.02](06.02-extractor-service.md): Serviço de extração estruturada local via Ollama.

## Evidências de Implementação
- `schemas/runtime-extraction.schema.json` — contrato JSON Schema.
- `tools/lib/runtime/extractor.js` — validador e serviço de extração.
- `test/runtime-fase2.test.js` — testes de validação e mock de inferência.

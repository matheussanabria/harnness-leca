# Épico 09 — Suíte de Testes e Validação da Fase 2

## Visão Geral
Cobertura automatizada da Fase 2 com mocks: contrato de extração, serviço de extração, delegação do roteador e caminho de motor local na CLI de artefatos.

## Histórias de Usuário
- [09.01](09.01-fase2-test-suite.md): Testes unitários com mocks de extração e roteamento integrado.

## Evidências de Implementação
- `test/runtime-fase2.test.js` — contrato, extração com mock e roteamento.
- `test/runtime-ollama-engine.test.js` — motor local ponta a ponta com daemon fake.
- `tests/hia-local-runtime-panel.test.js` — renderização do bloco de runtime local no painel HIA.

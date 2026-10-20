---
tags: [harness-evolution, plano-de-teste]
---

# Planos de teste

Um plano por épico ou vertical, a partir do [modelo](../_templates/test-plan-template.md). O baseline vem da história [00.04](../02-epics/EP-00-auditoria/00.04-baseline-testes.md).

| ID | Escopo | Histórias | Status |
|---|---|---|---|
| TP-00 | Baseline atual (testes, check, types, capturas) | 00.04 | a criar |
| TP-01 | Piloto do Window Manager na Estação Gemini | 01.01 a 01.08 | a criar |
| [TP-09](TP-09-central-sessoes.md) | Central de sessões, observabilidade e orquestração | 09.01 a 09.05 | especificado |

## Comandos disponíveis
- `npm test`: suíte `node:test` em `tests/*.test.js`
- `npm run check`: verificações do repositório
- `npm run types`: checagem de tipos

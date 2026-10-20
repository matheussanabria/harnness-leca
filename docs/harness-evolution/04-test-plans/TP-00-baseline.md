---
id: TP-00
escopo: "Baseline de testes, qualidade de código e verificação estática"
historias: ["00.04"]
tags: [harness-evolution, plano-de-teste, baseline]
data: 2026-10-19
commit: 152b06f
node: v24.22.0
---

# TP-00: Baseline (2026-10-19, commit 152b06f, Node v24.22.0)

Documento comprobatório de baseline do repositório antes de alterações do programa de engenharia (execução da história [00.04](../02-epics/EP-00-auditoria/00.04-baseline-testes.md)).

## 1. Resumo Executivo

| Comando | Total / Escopo | Aprovados | Falhos | Status | Log de Evidência |
|---|---|---|---|---|---|
| `npm test` | 256 testes em 40 arquivos | 256 | 0 | **VERDE** | [npm-test.log](baseline/npm-test.log) |
| `npm run check` | 359 arquivos .js e 9 .json | 368 | 0 | **VERDE** | [npm-check.log](baseline/npm-check.log) |
| `npm run types` | Checagem TypeScript (`tsc`) | - | 311 linhas de erro | **FALHA PRÉ-EXISTENTE** | [npm-types.log](baseline/npm-types.log) |

## 2. Falhas Pré-Existentes (Classificação e Causa Raiz)

A suíte de testes unitários e de integração (`node:test`) e a validação sintática (`check.js`) estão 100% verdes (256/256 testes passando).
Os erros em `npm run types` decorrem de verificações estáticas de TypeScript sobre código JavaScript sem tipagem estrita ou com propriedades dinâmicas do DOM:

| Categoria | Arquivos Típicos | Erro Frequente | Causa Provável | Bloqueia EP-01? |
|---|---|---|---|---|
| DOM / Window globals | `ui/public/js/app.js`, `deploy-modals.js` | `Property 'toggleInspectorMode' does not exist on type 'Window'` | Propriedades anexadas ao objeto `window` dinamicamente sem declaração em `.d.ts` | **Não** (comportamento de runtime funcional e testado) |
| HTML Elements | `deploy-modals.js` | `Property 'value' does not exist on type 'HTMLElement'` | `document.getElementById` sem cast para `HTMLInputElement` | **Não** |
| Top-level await | `ui/public/js/boot.js` | `'await' expressions are only allowed at top level when file is module` | Script carregado via tag padrão ou módulo ES sem config tsc | **Não** |
| Tipos Node HTTP | `tools/lib/network-access.js`, `proc-manager-store.js` | `Cannot find namespace 'http'` / `cp` | Falta de `@types/node` referenciado nos JSDocs dessas libs | **Não** |
| Adapters de Orquestração | `services/orchestration/adapters/*.js` | `Property 'startedAt' does not exist on type ...` | Campos opcionais retornados por processos não modelados no schema estático | **Não** |

## 3. Cobertura por Área

| Área | Arquivos de Teste | Situação |
|---|---|---|
| Servidor / Router / Auth | `server-api.test.js`, `permissions.test.js` | **Coberta** |
| Chat Universal & Streaming | `chat.test.js`, `chat-mobile-interaction.test.js` | **Coberta** |
| Motores de IA (Claude, Gemini, Opencode, Codex) | `engines.test.js`, `gemini-stream.test.js` | **Coberta** |
| Scrum & Sprints | `scrum.test.js`, `scrum-sprint.test.js` | **Coberta** |
| Protótipos & Studio | `prototype-*.test.js` (5 suítes) | **Coberta** |
| Orquestração & Event Engine | `orchestration.test.js` | **Coberta** |
| Escritório Virtual (Office 2D/3D / Drawers) | Nenhum teste unitário automatizado dedicado | **Sem teste automatizado** (validação manual/visual) |
| Datacenter / Deploy | Testes indiretos de deploy config | **Parcial** |

## 4. Regra de Não Regressão para Próximas Histórias

Qualquer entrega dos épicos subsequentes (a começar por [EP-01](../02-epics/EP-01-window-manager/README.md)):
1. Deve manter `npm test` rigorosamente com **256+ testes passando e 0 falhas**.
2. Deve manter `npm run check` com **0 erros**.
3. Não deve introduzir novos erros em `npm run types` além das 311 linhas catalogadas no baseline.

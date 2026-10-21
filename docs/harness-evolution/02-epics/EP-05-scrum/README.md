---
id: EP-05
titulo: Scrum & Sprints
prioridade: P1
status: concluido
depende: [EP-04]
tags: [harness-evolution, epico]
---

# EP-05: Scrum & Sprints

[Voltar ao índice](../../00-index.md)

## Objetivo
Representar o fluxo completo do SDLC.

## Execução
Migrar status, configurar 12 raias, reordenação horizontal, movimentação de histórias, impedimentos, métricas e projeção no telão.

## Entrega
Kanban configurável e integrado ao escritório.

## Aceite do épico
A ordem das raias é persistida por projeto, e reordenar colunas não altera o status das histórias.

## Contexto conhecido
Hoje há quatro status fixos em `projects/<slug>/scrum.json`. Migração e rollback estão em [06-data-security-tests](../../06-data-security-tests.md) (HAR-008 a HAR-011).

## Histórias
Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [05.01](05.01-migracao-compativel-status.md) | Migração compatível de status — concluída |
| [05.02](05.02-doze-raias-configuraveis.md) | Doze raias configuráveis — concluída |
| [05.03](05.03-reordenacao-horizontal.md) | Reordenação horizontal persistida por projeto — concluída |
| [05.04](05.04-movimentacao-transicoes.md) | Movimentação de histórias e transições — concluída |
| [05.05](05.05-impedimentos-filtros-metricas.md) | Impedimentos, filtros e métricas — concluída |
| [05.06](05.06-projecao-kanban-telao.md) | Projeção do Kanban no telão — concluída |
| [05.07](05.07-integracao-jira.md) | Integração com o Jira: leitura viva, consulta local e panorama — concluída (owner `opencode/jira`) |

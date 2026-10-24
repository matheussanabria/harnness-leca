---
id: EP-08
titulo: Agentes, skills e workflows
prioridade: P1
status: concluido
depende: [EP-05]
tags: [harness-evolution, epico]
---

# EP-08: Agentes, skills e workflows

[Voltar ao índice](../../00-index.md)

## Objetivo
Conectar a orquestração de IA às atividades do SDLC.

## Execução
Padronizar capacidades, associar agentes às etapas, vincular skills, executar workflows e controlar rotinas com aprovação e histórico.

## Entrega
Ações de agentes acessíveis pelo Scrum, chat e escritório.

## Aceite do épico
Execuções têm identificação, status verificável, permissões e evidências de resultado.

## Contexto conhecido
Event engine em `ui/server/services/orchestration/` (HAR-016, HAR-017). O catálogo canônico de capacidades foi entregue em 08.01, o de etapas do SDLC com agentes associados em 08.02, os vínculos de skills por projeto e raia em 08.03, a execução de workflows com eventos canônicos em 08.04 e as rotinas com aprovação e histórico em 08.05; passam a alimentar a API, os vínculos de agentes/skills, as rotinas e a fila de aprovações.

## Histórias
Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [08.01](./08.01-catalogo-capacidades.md) | Catálogo padronizado de capacidades (concluída) |
| [08.02](./08.02-agentes-por-etapa-sdlc.md) | Agentes associados às etapas do SDLC (concluída) |
| [08.03](./08.03-skills-projeto-raia.md) | Vínculo de skills por projeto e raia (concluída) |
| [08.04](./08.04-execucao-workflows.md) | Execução de workflows (concluída) |
| [08.05](./08.05-rotinas-aprovacao-historico.md) | Rotinas com aprovação e histórico (concluída) |
| [08.06](./08.06-ui-workflows.md) | Workflows UI: catalog, plan and runs (em andamento) |

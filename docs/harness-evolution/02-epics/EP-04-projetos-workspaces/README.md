---
id: EP-04
titulo: Projetos e workspaces
prioridade: P1
status: concluido
depende: [EP-01]
tags: [harness-evolution, epico]
---

# EP-04: Projetos e workspaces

[Voltar ao índice](../../00-index.md)

## Objetivo
Manter contexto consistente entre módulos e permitir layouts reutilizáveis.

## Execução
Centralizar a seleção do projeto, layouts nomeados, salvar configurações e restaurar janelas, filtros e recursos selecionados.

## Entrega
Templates de Desenvolvimento, Planejamento, Qualidade e Operações.

## Aceite do épico
Trocar de workspace sem trocar indevidamente de projeto ou perder alterações não salvas.

## Contexto conhecido
O projeto ativo hoje vem de `projects/.active` e do estado web em `shared/state.js`.

## Histórias
Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [04.01](04.01-selecao-projeto-centralizada.md) | Seleção de projeto centralizada — concluída |
| [04.02](04.02-layouts-nomeados.md) | Layouts nomeados — concluída |
| [04.03](04.03-persistencia-contexto-workspace.md) | Persistência de janelas, filtros e recursos selecionados — concluída |
| [04.04](04.04-templates-workspace.md) | Templates: Desenvolvimento, Planejamento, Qualidade e Operações — concluída |
| [04.05](04.05-protecao-alteracoes-nao-salvas.md) | Proteção de alterações não salvas na troca de workspace — concluída |

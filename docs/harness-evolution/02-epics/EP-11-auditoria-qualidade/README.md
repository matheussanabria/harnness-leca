---
id: EP-11
titulo: Auditoria, testes e Design System
prioridade: P2
status: planejado
depende: [EP-00, EP-07]
tags: [harness-evolution, epico]
---

# EP-11: Auditoria, testes e Design System

[Voltar ao índice](../../00-index.md)

## Objetivo
Consolidar regras de negócio, testes, componentes e paridade com o legado.

## Execução
Aprimorar a matriz de auditoria, distinguir testes gerados, executados e aprovados, integrar o Quadro de Componentes, corrigir inconsistências visuais e automatizar regressões.

## Entrega
Rastreabilidade entre requisito, código, componente, endpoint, teste e evidência.

## Aceite do épico
Métricas de cobertura representam evidências reais, não apenas a existência de documentos ou requisições.

## Contexto conhecido
Base em `project-audit.service.js` e `design-audit-*.js` (HAR-014, HAR-015, HAR-018, HAR-019).

## Histórias (provisórias)
Títulos a revisar depois do EP-00. Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| 11.01 | Matriz de auditoria com evidências |
| 11.02 | Testes gerados, executados e aprovados como estados distintos |
| 11.03 | Integração do Quadro de Componentes |
| 11.04 | Design System e inconsistências visuais |
| 11.05 | Regressão automatizada |

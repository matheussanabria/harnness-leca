---
id: EP-11
titulo: Auditoria, testes e Design System
prioridade: P2
status: em-andamento
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
Base em `project-audit.service.js` e `design-audit-*.js` (HAR-014, HAR-015, HAR-018, HAR-019). A 11.01 entregou a matriz de auditoria com evidências: quatro estados distintos (planejada, gerada, executada, aprovada), manifesto `audit-evidence.json` por projeto, detecção de artefatos reais e métricas que nunca apresentam teste gerado como aprovado. A 11.02 transformou os estados em ações verificáveis (gerar, executar, aprovar) e a 11.03 cruzou o Quadro de Componentes com a auditoria por componente.

## Histórias (provisórias)
Títulos a revisar depois do EP-00. Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [11.01](./11.01-matriz-auditoria-evidencias.md) | Matriz de auditoria com evidências (HAR-015) (concluída) |
| [11.02](./11.02-estados-de-teste-distintos.md) | Testes gerados, executados e aprovados como estados distintos (concluída) |
| [11.03](./11.03-integracao-quadro-componentes.md) | Integração do Quadro de Componentes (HAR-014) (concluída) |
| 11.04 | Design System e inconsistências visuais |
| 11.05 | Regressão automatizada |

---
id: EP-10
titulo: Datacenter e deploys
prioridade: P2
status: em-andamento
depende: [EP-09]
tags: [harness-evolution, epico]
---

# EP-10: Datacenter e deploys

[Voltar ao índice](../../00-index.md)

## Objetivo
Evoluir a estação Datacenter para um centro operacional.

## Execução
Integrar pipelines, ambientes, histórico, logs, indicadores de saúde e ações de deploy autorizadas.

## Entrega
Mesmo estado operacional no painel tradicional e no escritório.

## Aceite do épico
Ações críticas exigem confirmação e não apresentam resultados fictícios.

## Contexto conhecido
Dados atuais em `global/deployments.json` e `global/deploy-history.json`.

## Histórias (provisórias)
Títulos a revisar depois do EP-00. Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [10.01](./10.01-integracao-pipelines.md) | Integração de pipelines (concluída) |
| [10.02](./10.02-ambientes-indicadores-saude.md) | Ambientes e indicadores de saúde (concluída) |
| 10.03 | Histórico e logs de deploy |
| 10.04 | Ações de deploy autorizadas com confirmação |
| 10.05 | Paridade entre painel tradicional e escritório |

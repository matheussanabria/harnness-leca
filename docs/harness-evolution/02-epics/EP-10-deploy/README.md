---
id: EP-10
titulo: Datacenter e deploys
prioridade: P2
status: concluido
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
Dados atuais em `global/deployments.json` e `global/deploy-history.json`. A 10.01 entregou pipelines com execução real por estágio, a 10.02 os indicadores de saúde por ambiente, a 10.03 a linha do tempo unificada com logs, a 10.04 as ações autorizadas com confirmação e a 10.05 a paridade entre o painel e o Escritório.

## Histórias (provisórias)
Títulos a revisar depois do EP-00. Cada história ganha um arquivo próprio a partir do [template](../../_templates/story-template.md) quando for detalhada.

| ID | Título |
|---|---|
| [10.01](./10.01-integracao-pipelines.md) | Integração de pipelines (concluída) |
| [10.02](./10.02-ambientes-indicadores-saude.md) | Ambientes e indicadores de saúde (concluída) |
| [10.03](./10.03-historico-logs-deploy.md) | Histórico e logs de deploy (concluída) |
| [10.04](./10.04-acoes-autorizadas-confirmacao.md) | Ações de deploy autorizadas com confirmação (concluída) |
| [10.05](./10.05-paridade-painel-escritorio.md) | Paridade entre painel tradicional e escritório (concluída) |

# 03 - Fases e backlog

## Fases

| Fase | Prioridade | Entrega | Criterio de conclusao |
|---|---|---|---|
| F0 Auditoria e diagnostico | P0 | Arquitetura real, consumo de contexto, hooks, sincronizacao, ferramentas | Inventario tecnico, gargalos confirmados, metricas de referencia |
| F1 Arquitetura e contratos | P0 | Contratos de tarefa, automacao, modelo, contexto, orcamento, execucao, resultado | ADRs, fluxos, contratos e plano de integracao aprovados |
| F2 Automation Registry | P0 | Scripts deterministicos com schema, permissao, timeout, log, teste | Operacoes reais funcionando sem LLM |
| F3 Context Engine | P0 | Indexacao incremental, recuperacao seletiva, deduplicacao, limites | Contexto minimo suficiente e rastreavel |
| F4 Local Runtime e Benchmark | P1 | Hardware Profiler, Ollama Adapter, catalogo de modelos, benchmarks | Modelos escolhidos com evidencia de qualidade, latencia e memoria |
| F5 Intelligent Router | P1 | Roteamento script, local e nuvem com fallback e aprovacao | Tarefas direcionadas por politica e capacidade comprovada |
| F6 Execution Guard e Telemetry | P1 | Filas, concorrencia, retries, checkpoints, metricas, deteccao de loops | Execucoes observaveis, interrompiveis e limitadas |
| F7 Integracao e otimizacao | P2 | Chat, DAI, Studio, Scrum e Escritorio 3D; ajuste de politicas | Fluxo ponta a ponta validado contra a linha de base |

Dependencias: F2, F3 e F4 avancam em paralelo apos F1. F6 comeca com instrumentacao minima cedo e se consolida apos o roteador.

## Backlog inicial

| ID | Entrega | Prio |
|---|---|---|
| HIA-001 | Auditoria dos motores, hooks e contexto repetido | P0 |
| HIA-002 | Inventario de scripts e funcionalidades reutilizaveis | P0 |
| HIA-003 | Linha de base de consumo e desempenho | P0 |
| HIA-004 | Contratos Task, Execution, Tool e Model | P0 |
| HIA-005 | Automation Registry e executor seguro | P0 |
| HIA-006 | Indexacao incremental e recuperacao de contexto | P0 |
| HIA-007 | Hardware Profiler | P1 |
| HIA-008 | Ollama Adapter | P1 |
| HIA-009 | Benchmark Runner com datasets versionados | P1 |
| HIA-010 | Model Registry e roteamento hibrido | P1 |
| HIA-011 | Resource Governor e Execution Guard | P1 |
| HIA-012 | Dashboard de metricas e economia | P2 |
| HIA-013 | Integracao com os agentes DAI e interfaces | P2 |
| HIA-014 | Testes ponta a ponta e relatorio comparativo | P2 |

Regra de aceite transversal: nada pode quebrar os motores CLI atuais; o novo roteamento e desabilitavel e o fluxo anterior permanece como fallback.

## Modulos conceituais a especificar na F1

Automation Registry, Script Executor, Context Engine, Local Model Adapter, Model Registry, Benchmark Runner, Intelligent Task Router, Resource Governor, Execution Guard, Telemetry e Quality Metrics. Para cada um: responsabilidade e limites, entradas e saidas, contratos, dependencias, integracao existente, permissoes, falhas, testes, criterios de aceite, riscos e rollback.

## Dossie

Verificar a convencao existente de `docs/` (ha `docs/harness-evolution/`). Se adequada, reutilizar; senao usar `docs/harness-intelligence/` com README, 00-executive-summary, 01-current-state-audit, 02-target-architecture, 03-technical-decisions, 04-implementation-backlog, 05-benchmark-plan, 06-security-and-quality, 07-implementation-progress, 08-results-and-metrics. Referencias cruzadas, sem repetir contexto; `MAPA.md` aponta para o conjunto.

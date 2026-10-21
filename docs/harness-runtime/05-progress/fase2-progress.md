# Acompanhamento de Progresso — Local AI Runtime (Fase 2)

## Resumo Geral

- **Total de Histórias:** 6
- **Concluídas:** 6
- **Em Andamento:** 0
- **Planejadas:** 0
- **Status:** 100% Implementado e Testado

## Tabela de Histórias

| ID | Épico | Título | Status | Evidências |
|---|---|---|---|---|
| [06.01](../02-epics/EP-06-extraction/06.01-extraction-schema.md) | EP-06 | Contrato Estrito de Extração de Conhecimento | Concluída | `schemas/runtime-extraction.schema.json`, `validateExtraction` em `tools/lib/runtime/extractor.js` |
| [06.02](../02-epics/EP-06-extraction/06.02-extractor-service.md) | EP-06 | Serviço de Extração Estruturada Local via Ollama | Concluída | `extractKnowledge` com prompt determinístico, `temperature 0.1`, `numCtx 4096` |
| [07.01](../02-epics/EP-07-hia-router-integration/07.01-router-runtime-bridge.md) | EP-07 | Ponte entre HIA Router e Local Runtime | Concluída | `tools/lib/hia/router.js` — camada Local-First com `ollama:qwen3.5:4b` |
| [08.01](../02-epics/EP-08-artifact-pipeline/08.01-local-artifacts-cli.md) | EP-08 | Extensão de Extração Local com `--engine ollama` | Concluída | `tools/lib/llm.js` (`askOllama`), `tools/lib/runtime/ollama-cli.js`, `generateText` |
| [09.01](../02-epics/EP-09-test-suite/09.01-fase2-test-suite.md) | EP-09 | Suíte de Testes Unitários e de Integração da Fase 2 | Concluída | `tests/runtime-fase2.test.js`, `tests/runtime-ollama-engine.test.js`, `tests/hia-local-runtime-panel.test.js` |

## Itens Transversais Concluídos

| Item | Evidência |
|---|---|
| Observabilidade do runtime local no painel HIA | `ui/public/js/modules/chat-hia-local-runtime.js`, `ui/public/css/hia-dashboard.css` |
| Endpoint com métricas do runtime local | `ui/server/controllers/hia.controller.js` — `GET /api/hia/metrics` → `localRuntime` |
| Agregação de telemetria do runtime | `tools/lib/runtime/telemetry.js` — `getRuntimeTelemetryMetrics()` |

## Decisões de Arquitetura

- [ADR-004](../03-decisions/ADR-004-local-first-extraction-pipeline.md) — Pipeline de extração local-first.
- [ADR-005](../03-decisions/ADR-005-hia-router-runtime-delegation.md) — Delegação dinâmica do roteador HIA para o runtime local.

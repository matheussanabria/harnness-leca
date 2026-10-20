# 04 - Backlog Priorizado de Implementação (F1)

**Status:** Aprovado em F1 | **Data:** 2026-10-19 | **Referência:** Contratos F1 (`schemas/hia-*.json`)

---

## 1. Visão Geral das Fases e Paralelismo

```
[F0: Auditoria & Diagnóstico]  (Concluído)
              |
[F1: Arquitetura & Contratos]  (Em conclusão nesta etapa)
              |
    +---------+---------+
    |         |         |
    v         v         v
 [F2: Reg] [F3: Ctx] [F4: Local]  (Paralelizáveis após F1)
    |         |         |
    +---------+---------+
              |
              v
     [F5: Router Inteligente]
              |
              v
 [F6: Resource Guard & Telemetria]
              |
              v
 [F7: Integração & Otimização Contínua]
```

---

## 2. Detalhamento dos Itens de Backlog (HIA-001 a HIA-014)

### Fase 0 — Diagnóstico e Linha de Base (P0)

| ID | Título | Status | Critério de Aceite / Evidência |
|---|---|---|---|
| **HIA-001** | Auditoria dos motores, hooks e contexto repetido | Concluído | Documento `docs/harness-intelligence/01-current-state-audit.md` gerado com evidências reais de payloads e sem suposições não testadas. |
| **HIA-002** | Inventário de scripts e capacidades reutilizáveis | Concluído | Mapeamento de `classify.js`, `coordination.js`, `redact.js`, `permissions.js` e `proc-manager.js` documentado na auditoria e integrado à arquitetura alvo. |
| **HIA-003** | Linha de base de consumo e desempenho | Concluído | Apuração empírica das sessões locais: 3.236 chamadas Claude (69% subagentes) e 43 sessões Codex com 96,9% cache hit; medições reais separadas de hipóteses. |

---

### Fase 1 — Arquitetura e Contratos (P0)

| ID | Título | Status | Critério de Aceite / Evidência |
|---|---|---|---|
| **HIA-004** | Contratos canônicos de `Task`, `Execution`, `Tool` e `Model` | Concluído | 4 arquivos JSON Schema Draft-07 válidos em `schemas/hia-*.schema.json`; validados por `npm run check`. |

---

### Fase 2 — Automation Registry (P0)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-005** | Automation Registry e executor determinístico seguro | Concluído | HIA-004 | `tools/lib/hia/registry.js`, `tools/lib/hia/executor.js`, `tools/hia.js`, `tests/hia-registry.test.js` | 1. 5 ferramentas determinísticas catalogadas (`git.status`, `repo.check`, `taxonomy.classify`, `coordination.status`, `context.list`).<br>2. Executor seguro com timeout, sandbox anti-path-traversal e bloqueio de comandos destrutivos.<br>3. CLI `npm run hia` (list, info, run).<br>4. 10/10 testes unitários verdes em `tests/hia-registry.test.js`. |

---

### Fase 3 — Context Engine (P0)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-006** | Indexação incremental e recuperação seletiva de contexto | Concluído | HIA-004 | `tools/lib/hia/context-engine.js`, `tools/lib/hia/index-cache.js`, `tools/lib/engines/common.js`, `tests/hia-context.test.js` | 1. Escopos seletivos implementados (`none`, `minimal`, `project_only`, `full`).<br>2. Cache SHA-256 com detecção de arquivos inalterados.<br>3. Fatiador granular `getMapSection` para evitar envio dos 61 KB do `MAPA.md`.<br>4. 100% de retrocompatibilidade em `getProjectContext`.<br>5. 10/10 testes unitários verdes em `tests/hia-context.test.js`. |

---

### Fase 4 — Local Runtime & Benchmark (P1)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-007** | Hardware Profiler local | Concluído | Nenhuma | `tools/lib/hia/hardware-profiler.js`, `tests/hia-hardware.test.js` | 1. Medição em tempo real de RAM livre e threads disponíveis na CPU Ryzen 5 7430U.<br>2. Alerta preventivo para RAM < 3 GB.<br>3. 3/3 testes verdes em `tests/hia-hardware.test.js`. |
| **HIA-008** | Ollama Adapter | Concluído | HIA-004 | `tools/lib/engines/ollama.js`, `tools/lib/engines/index.js`, `tools/lib/engines/catalog.json` | 1. Interface canônica `{ id: "ollama", stream, status }` sem quebrar motores existentes.<br>2. Suporte a streaming e AbortSignal.<br>3. Ícone e catálogo livres de emojis (regra estrita).<br>4. 3/3 testes verdes em `tests/hia-ollama.test.js`. |
| **HIA-009** | Benchmark Runner com datasets versionados | Concluído | HIA-007, HIA-008 | `tools/lib/hia/benchmark.js`, `tests/fixtures/benchmark/*.json`, `docs/harness-intelligence/05-benchmark-plan.md` | 1. Dataset versionado `intent-classification.json`.<br>2. Dossiê `05-benchmark-plan.md` aprovado.<br>3. 3/3 testes verdes em `tests/hia-benchmark.test.js`. |

---

### Fase 5 — Intelligent Router (P1)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-010** | Model Registry e Intelligent Task Router | Concluído | HIA-005, HIA-006, HIA-008, HIA-009 | `tools/lib/hia/router.js`, `tools/lib/hia/model-registry.js`, `tools/lib/engines/gemini.js`, `tests/hia-router.test.js` | 1. Roteador Script-First -> Local-First -> Cloud em camadas.<br>2. Feature flag `HIA_ROUTING_ENABLED=false` respeitada.<br>3. Fallback silencioso do Gemini eliminado (ADR-HIA-003).<br>4. 4/4 testes verdes em `tests/hia-router.test.js`. |

---

### Fase 6 — Execution Guard & Telemetria (P1)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-011** | Resource Governor e Execution Guard | Concluído | HIA-010 | `tools/lib/hia/guard.js`, `tools/lib/hia/telemetry.js`, `tests/hia-guard.test.js` | 1. `ExecutionQueue` com concorrência máxima = 1 para inferência local.<br>2. `LoopGuard` detectando 3 repetições consecutivas idênticas.<br>3. Gravação e leitura de telemetria conforme `schemas/hia-execution.schema.json`.<br>4. 3/3 testes verdes em `tests/hia-guard.test.js`. |

---

### Fase 7 — Integração, UI e Otimização Contínua (P2)

| ID | Título | Status | Dependências | Arquivos Afetados | Critério de Aceite / Evidência |
|---|---|---|---|---|---|
| **HIA-012** | Dashboard de métricas de economia e telemetria | Concluído | HIA-011 | `ui/server/controllers/hia.controller.js`, `ui/server/services/hia-chat-dispatcher.service.js`, `ui/public/js/modules/hia-dashboard.js`, `ui/public/css/hia-dashboard.css` | 1. Endpoint `GET /api/hia/metrics` fornecendo telemetria, hardware, registry e config.<br>2. Dispatcher HIA integrado ao `apiChat` para interceptação Script-First sem alterar o fluxo existente.<br>3. Painel CSS com design tokens do Harness, zero emojis, ícones FontAwesome. |
| **HIA-013** | Integração com DAI e motores via dispatcher | Concluído | HIA-010 | `ui/server/controllers/chat.controller.js`, `ui/server/services/hia-chat-dispatcher.service.js` | 1. `handleChatWithHia` intercepta automações determinísticas antes de consumir cota de nuvem.<br>2. Contexto DAI carregado sob demanda pelo `context-engine` com escopos seletivos.<br>3. Fallback transparente para o motor solicitado quando a tarefa exige raciocínio em nuvem. |
| **HIA-014** | Testes ponta a ponta e relatório comparativo | Em andamento | HIA-012, HIA-013 | `tests/hia-e2e.test.js`, `docs/harness-intelligence/08-results-and-metrics.md` | 1. 36/36 testes unitários HIA verdes (F2 a F6).<br>2. Relatório formal de resultados pendente após coleta de métricas de produção. |

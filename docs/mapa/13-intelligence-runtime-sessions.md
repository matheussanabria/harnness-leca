## 13. Intelligence & Automation

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-intelligence/README.md` | Índice do dossiê da iniciativa (Script-First, Local-First, Cloud-on-Demand) e estado de cada documento. |
| `docs/harness-intelligence/01-current-state-audit.md` | F0: auditoria de motores, contexto injetado, métricas, infraestrutura e oportunidades, com fatos separados de hipóteses. |
| `docs/harness-intelligence/02-target-architecture.md` | F1: arquitetura pretendida em 5 pilares, módulos, fluxo de execução e integração com motores existentes. |
| `docs/harness-intelligence/03-technical-decisions.md` | F1: ADRs técnicas de contratos (ADR-HIA-001), fan-out de subagentes (ADR-HIA-002), política de fallback (ADR-HIA-003) e runtime Ollama (ADR-HIA-004). |
| `docs/harness-intelligence/04-implementation-backlog.md` | F1: backlog detalhado HIA-001 a HIA-014 com dependências, critérios de aceite e prioridades. |
| `docs/harness-intelligence/06-security-and-quality.md` | F1: governança de segurança (allowlist, path traversal, ofuscação de segredos) e qualidade (anti-monólito < 300 linhas, FontAwesome). |
| `schemas/hia-task.schema.json` | F1: contrato canônico JSON Schema (Draft-07) para definição de tarefas e intenções no HIA. |
| `schemas/hia-execution.schema.json` | F1: contrato canônico JSON Schema para telemetria e registros de execução de tarefas. |
| `schemas/hia-tool.schema.json` | F1: contrato canônico JSON Schema para o Automation Registry (scripts determinísticos seguros). |
| `schemas/hia-model.schema.json` | F1: contrato canônico JSON Schema para o Model Registry (capacidades, requisitos de RAM/CPU e custos). |
| `tools/hia.js` | F2: CLI de inspeção e execução segura de ferramentas do Automation Registry (`npm run hia`). |
| `tools/lib/hia/registry.js` | F2: catálogo declarativo de ferramentas determinísticas do Harness com validação de schemas. |
| `tools/lib/hia/executor.js` | F2: executor seguro com sandbox de caminhos, sanitização de comandos, métricas de tempo e timeouts. |
| `tests/hia-registry.test.js` | F2: suíte de testes unitários do Automation Registry e salvaguardas de execução. |
| `tools/lib/hia/context-engine.js` | F3: Context Engine seletivo com escopos (minimal/project_only/full), fatiador do MAPA.md e estimativa de tokens. |
| `tools/lib/hia/index-cache.js` | F3: cache em memória com hashes SHA-256 para indexação incremental de arquivos de contexto. |
| `tests/hia-context.test.js` | F3: suíte de testes unitários do Context Engine, escopos e fatiamento sob demanda. |
| `tools/lib/hia/hardware-profiler.js` | F4: medidor de capacidade da CPU AMD Ryzen 5 e RAM host com alocação segura de threads e alerta de RAM livre. |
| `tests/hia-hardware.test.js` | F4: testes unitários do profiler de hardware e limites de segurança. |
| `tools/lib/engines/ollama.js` | F4: adaptador de motor local Ollama em CPU com streaming SSE, guard de RAM e listagem de modelos. |
| `tests/hia-ollama.test.js` | F4: testes unitários do motor Ollama e tratamento resiliente de erros de daemon. |
| `docs/harness-intelligence/05-benchmark-plan.md` | F4: plano de benchmark e critérios empíricos de avaliação para modelos locais. |
| `tests/fixtures/benchmark/intent-classification.json` | F4: dataset versionado para benchmark de classificação de intenção e extração. |
| `tools/lib/hia/benchmark.js` | F4: runner automatizado de benchmark de modelos locais contra datasets versionados. |
| `tests/hia-benchmark.test.js` | F4: testes unitários do benchmark runner. |
| `tools/lib/hia/model-registry.js` | F5: catálogo canônico de modelos, contextos, tiers e capacidades técnicas. |
| `tools/lib/hia/router.js` | F5: roteador inteligente em camadas (Script-First -> Local-First -> Cloud) com feature flag `HIA_ROUTING_ENABLED`. |
| `tests/hia-router.test.js` | F5: testes unitários de decisão de roteamento e desativação por flag. |
| `tools/lib/hia/guard.js` | F6: Resource Governor (concorrência máxima = 1 para CPU) e detector de repetição em loop. |
| `tools/lib/hia/telemetry.js` | F6: persistência de telemetria em JSONL com métricas de execuções e tokens economizados. |
| `tests/hia-guard.test.js` | F6: testes unitários do Execution Guard, concorrência e telemetria. |
| `ui/server/controllers/hia.controller.js` | F7: endpoint REST `GET /api/hia/metrics` expondo telemetria, hardware e configuração do roteador. |
| `ui/server/services/hia-chat-dispatcher.service.js` | F7: despachante de chat que intercepta automações determinísticas (Script-First) antes de consumir cota de nuvem. |
| `ui/public/js/modules/hia-dashboard.js` | F7: módulo que agrega payload de métricas HIA para uso pelo frontend do Harness. |
| `ui/public/css/hia-dashboard.css` | F7: estilos do painel de métricas com design tokens do Harness, zero emojis, ícones FontAwesome. |


## 14. Harness Local AI Runtime (Fase 1 e Fase 2)

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-runtime/00-index.md` | Índice mestre, grafo Mermaid e governança da Fase 1 do Runtime Local. |
| `docs/harness-runtime/00-index-fase2.md` | Índice mestre, contratos e épicos da Fase 2 (Extração Estruturada & HIA Router). |
| `schemas/runtime-extraction.schema.json` | Contrato JSON Schema Draft-07 para extração estruturada de decisões, regras e termos. |
| `tools/lib/runtime/ollama-client.js` | Cliente HTTP resiliente para Ollama com health check, tags, inferência JSON estruturada (`generateStructured`) e inferência em texto livre (`generateText`). |
| `tools/lib/runtime/ollama-cli.js` | Runner síncrono do motor local: lê o prompt no stdin e devolve a resposta do daemon no stdout. |
| `tools/lib/runtime/schema.js` | Validador estrito do contrato canônico de classificação de tarefas. |
| `tools/lib/runtime/classifier.js` | Serviço determinístico de classificação de tarefas locais. |
| `tools/lib/runtime/extractor.js` | Serviço de extração estruturada de conhecimento e validação de schema. |
| `tools/lib/runtime/shadow.js` | Interceptor assíncrono não bloqueante para modo shadow com zero fallback de nuvem. |
| `tools/lib/runtime/telemetry.js` | Gravação sanitizada append-only de métricas de inferência em JSONL e agregação `getRuntimeTelemetryMetrics`. |
| `ui/public/js/modules/chat-hia-local-runtime.js` | Bloco do painel HIA com métricas do runtime local: inferências, validade, tokens, duração e distribuições. |
| `tests/runtime-local.test.js` | Bateria de testes unitários com mocks da Fase 1. |
| `tests/runtime-fase2.test.js` | Bateria de testes unitários de extração e delegação HIA da Fase 2. |
| `tests/runtime-ollama-engine.test.js` | Testes do caminho de motor local (texto livre, formato JSON e runner) com daemon fake. |
| `tests/hia-local-runtime-panel.test.js` | Testes de renderização do bloco de runtime local no painel HIA. |


## 15. Registro Canônico de Sessões (EP-09.01)

| Caminho | Responsabilidade |
|---|---|
| `ui/server/services/canonical-sessions/session-model.js` | Modelo canônico: fingerprint, enums de estado, criação, migração aditiva e validação. |
| `ui/server/services/canonical-sessions/session-registry.service.js` | Registro por projeto (`projects/<slug>/canonical-sessions.json`) com escrita atômica, leitura tolerante e vínculo explícito. |
| `ui/server/services/canonical-sessions/session-registry-orchestrator.service.js` | Junta descoberta, reconciliação e registro; monta o read model da Central. |
| `ui/server/services/canonical-sessions/session-reconciler.service.js` | Ordem de correspondência: exata, metadado explícito, origem reconciliada, inferida como candidata e sem vínculo. |
| `ui/server/services/canonical-sessions/session-workflow-linker.js` | Projeta o estado de workflow da 08.05 sobre as sessões, sem duplicar a fonte de verdade. |
| `ui/server/services/canonical-sessions/discovery/markdown-discovery.js` | Porta de descoberta das conversas em Markdown (somente leitura). |
| `ui/server/services/canonical-sessions/discovery/session-discovery.service.js` | Orquestrador das portas de descoberta, com deduplicação por fingerprint. |
| `ui/server/controllers/canonical-session.controller.js` | API de leitura e de vínculo do registro canônico. |
| `ui/server/routes/canonical-sessions.routes.js` | Rotas `GET/POST /api/project/:slug/sessions[...]`. |
| `tests/canonical-session-registry.test.js` | Testes do registro: escrita, migração, leitura tolerante, vínculo e filtros. |
| `tests/canonical-session-discovery.test.js` | Testes da descoberta somente leitura e da reconciliação. |
| `tests/canonical-session-http.test.js` | Testes da API: leitura, filtros, loopback, evidência e 404. |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/10-contrato-leitura-central.md` | Contrato de leitura congelado entre a 09.02 (event log) e a 09.03 (Central). |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.02-event-log-sse.md` | História do event log persistente, projeções e recuperação SSE. |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.04-navegacao-retomada.md` | História de navegação, retomada e integração com Chat e Escritório (detalhada). |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/09.05-atencao-aprovacoes.md` | História de atenção necessária, notificações e fila de aprovações (detalhada). |
| `ui/server/services/events/event-store.js` | Log append-only por projeto em SQLite nativo, com cursor, idempotência e aliases de tipo. |
| `ui/server/services/events/event-projector.js` | Projeções de sessões, execuções e atenção, reconstruíveis a partir do log. |
| `ui/server/services/events/event-stream.js` | Stream SSE com cursor, keep-alive e fechamento limpo. |
| `ui/server/controllers/central-events.controller.js` | API de eventos, projeções, stream recuperável e publicação (loopback). |
| `ui/server/routes/central-events.routes.js` | Rotas `GET/POST /api/project/:slug/events`, `/projections` e `/sessions/stream`. |
| `tests/central-events.test.js` | Testes do log, das projeções e do formato SSE. |
| `tests/central-events-http.test.js` | Testes da API de eventos, das projeções e do stream. |
| `tools/types-baseline.js` | Baseline de tipos: falha quando a divida de erros de JSDoc cresce (EP-11.05). |
| `tools/lib/tsc-runner.js` | Runner do TypeScript (instalacao em cache) compartilhado entre `npm run types` e o baseline. |
| `quality/types-baseline.json` | Baseline versionado da divida de tipos, com a data da medicao. |
| `scripts/regressao.js` | Suite de regressao: check, testes, indice mestre e baseline de tipos (EP-11.05). |
| `tools/verify-index.js` | Verificador do indice mestre: links, contagem por epico (tabela x checklist) e totais declarados contra a soma real. |
| `tests/verify-index.test.js` | Testes do verificador do indice, incluindo a consistencia do indice real do repositorio. |
| `tools/lib/coordination/config.js` | Provedores do ledger e `STORY_OWNERS`: dono por história, para que a frente substitua o nome do motor. |

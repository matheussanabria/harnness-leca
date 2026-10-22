# Progresso da implementação

Atualizado em 2026-10-21. Este registro descreve o working tree atual, que contém alterações concorrentes de outros chats.

| Fase | Status | Histórias | Implementado | Evidência/testes | Pendências | Próximo passo |
|---|---|---|---|---|---|---|
| 0 — Diagnóstico | Validado | HAR-001 | Auditoria, arquitetura, riscos e backlog | Documentos `01` a `08`; links verificados | Capturas visuais ausentes | Manter registro por entrega |
| 1 — Chat Universal | Em andamento | HAR-003 a HAR-005, HAR-007 | Apresentações declarativas; envio direto; sessões, execução, cancelamento e UI de streaming por projeto/conversa | `chat-mobile-interaction.test.js` | Teste em navegador e persistência de rascunhos por apresentação | Preparar teste em navegador |
| 2 — Studio responsivo | Em andamento | HAR-006 | Sidebar persistente; Pointer Events; teclado; ARIA; limites responsivos; editor de fonte; projeção multiframework do Prototype Engine | Testes de Chat/Studio, `source-workspace`, `prototype-studio` e `prototype-traceability` | Toque real, seis viewports, iframe estável e aceite E2E | Criar teste em navegador |
| 3 — Kanban SDLC | Validado | HAR-008 a HAR-011 | Schema v2, 12 raias configuráveis, ordem persistida, transições adjacentes, histórico atômico, impedimentos, filtros, métricas e projeção no telão | Testes de migração, fontes, raias, ordem, transições, impedimentos e UI Scrum | Aceite em navegador | Manter |
| 4 — Mapa em Camadas | Parcial (HAR-013 aceito) | HAR-012 e HAR-013 | Serviços e navegação modular; vínculos artefato ↔ tela/campo com abertura na camada correta | Testes de design/layers e `artifact-relationships` | Fidelidade visual do Mapa (HAR-012) e capturas | Obter referências visuais |
| 5 — Scrum e Backlog | Validado | HAR-008, HAR-011 | Schema v2, migração/rollback, 12 raias configuráveis/reordenáveis, transições auditáveis, CRUD, persistência, edição e impedimentos | Testes `project-scrum-*`, UI de raias/transições e fontes Scrum | Aceite em navegador | Manter |
| 6 — Componentes | Em andamento | HAR-014 | Seis marcos calculados e envio ao chat | `design-schema-stages.test.js` | Marcos independentes na UI, histórico e referências | Evoluir após rastreabilidade |
| 7 — Auditoria | Em andamento | HAR-015 | Matriz de auditoria com evidências, filtros, comparação com legado e quatro estados de evidência (EP-11.01) | Módulos `design-audit-*`, `ui/server/services/audit/*` | Evidência planejada/gerada/executada/aprovada com manifesto por projeto | 11.02: testes gerados, executados e aprovados como estados distintos |
| 8 — Agentes e workflows | Concluído | HAR-016 e HAR-017 | Event engine, adapters, endpoints, catálogo canônico de capacidades (EP-08.01), etapas do SDLC com agentes (EP-08.02), vínculos de skills por projeto e raia (EP-08.03), execução de workflows com eventos canônicos (EP-08.04) e rotinas com aprovação e histórico (EP-08.05) | `orchestration.test.js`, `capability-catalog.test.js`, `agent-stage-catalog.test.js`, `skill-bindings.test.js`, `workflow-runner.test.js`, `workflow-http.test.js`, `routine-runner.test.js`, `routine-http.test.js`, `routine-ui.test.js` | Política por raia, idempotência e aprovação | Detalhar 09.01 com o contrato de rotinas e aprovações |
| 9 — Design System | Validado no EP-12 | HAR-002 | Registry, extração, preview isolado, tokens, boilerplates, geração Vanilla/Angular/React, Studio e rastreabilidade | Marcos M1, M2 e M3 homologados | Hardening visual e evolução incremental dos kits | Integrar os consumidores dos demais épicos |
| 10 — Hardening | Em andamento | HAR-018 e HAR-019 | Testes focados e controles de segurança | `npm run check` passou em 437 JS e 10 JSON; 46 testes de EP-12.21 a 12.30 passaram | `npm run types` não está verde; faltam E2E/visual e estabilização da suíte integral | Corrigir o gate de tipos e executar aceite em navegador |

## Entrega atual

- Chat: inventário e modelos canônicos concluídos; apresentações compartilhadas já possuem implementação parcial, mas 02.03 a 02.08 ainda exigem histórias e aceite próprios.
- Prototype Engine: 32/32 histórias concluídas; renderer/inspetor, geração multiframework, integração com Studio, rastreabilidade e piloto DIS foram homologados.
- Projetos e workspaces: EP-04 concluído em 5/5 com seleção centralizada, persistência composta, quatro templates canônicos e guard de alterações não salvas.
- Scrum: EP-05 concluído em 6/6; ordem e transições das 12 raias são persistidas com concorrência otimista e histórico, preservando a origem Jira; impedimentos, filtros, métricas e projeção no telão aceitos.
- Artefatos: EP-07 concluído em 5/5; inventário, importação, metadados, acesso, previews seguros e vínculos navegáveis no Mapa em Camadas (HAR-013); HAR-012 segue bloqueada por falta de referências visuais.
- Agentes: EP-08 em 4/5; catálogo canônico de capacidades versionado por provedor (estados, modos, escopos, campos legados e cancelamento externo rebaixado a `degraded`), catálogo de etapas do SDLC com os agentes DAI, papéis e gates, vínculos de skills por projeto e raia com manifesto versionado e órfãos e execução de workflows com plano por projeto, ciclo de vida e eventos canônicos; as rotas de orquestração, de vínculos e de workflows foram consolidadas em módulos próprios sem regressão.
- EP-12 encerrado pelo Marco M3; a evolução seguinte volta ao Chat Universal (EP-02) e aos módulos consumidores.
- Limitação transversal: validações unitárias e estruturais estão verdes nos recortes executados, mas o typecheck global e o aceite em navegador ainda não estão concluídos.

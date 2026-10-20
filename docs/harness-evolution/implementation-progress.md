# Progresso da implementação

Atualizado em 2026-10-19. Este registro descreve o working tree atual, que contém alterações concorrentes de outros chats.

| Fase | Status | Histórias | Implementado | Evidência/testes | Pendências | Próximo passo |
|---|---|---|---|---|---|---|
| 0 — Diagnóstico | Validado | HAR-001 | Auditoria, arquitetura, riscos e backlog | Documentos `01` a `08`; links verificados | Capturas visuais ausentes | Manter registro por entrega |
| 1 — Chat Universal | Em andamento | HAR-003 a HAR-005, HAR-007 | Apresentações declarativas; envio direto; sessões, execução, cancelamento e UI de streaming por projeto/conversa | `chat-mobile-interaction.test.js` | Teste em navegador e persistência de rascunhos por apresentação | Preparar teste em navegador |
| 2 — Studio responsivo | Em andamento | HAR-006 | Sidebar persistente; Pointer Events; teclado; ARIA; limites responsivos; editor de fonte; projeção multiframework do Prototype Engine | Testes de Chat/Studio, `source-workspace`, `prototype-studio` e `prototype-traceability` | Toque real, seis viewports, iframe estável e aceite E2E | Criar teste em navegador |
| 3 — Kanban SDLC | Em andamento | HAR-008 a HAR-011 | Schema v2, 12 raias configuráveis, ordem persistida, transições adjacentes e histórico atômico | Testes de migração, fontes, raias, ordem, transições e UI Scrum | Impedimentos, filtros e métricas | Detalhar 05.05 |
| 4 — Mapa em Camadas | Bloqueado | HAR-012 e HAR-013 | Serviços e navegação modular | Testes de design/layers | Capturas e rastreabilidade ponta a ponta | Obter referências visuais |
| 5 — Scrum e Backlog | Em andamento | HAR-008, HAR-011 | Schema v2, migração/rollback, 12 raias configuráveis/reordenáveis, transições auditáveis, CRUD, persistência e edição | Testes `project-scrum-*`, UI de raias/transições e fontes Scrum | Impedimentos, filtros, métricas e contexto tipado | Detalhar 05.05 |
| 6 — Componentes | Em andamento | HAR-014 | Seis marcos calculados e envio ao chat | `design-schema-stages.test.js` | Marcos independentes na UI, histórico e referências | Evoluir após rastreabilidade |
| 7 — Auditoria | Em andamento | HAR-015 | Matriz, filtros e comparação com legado | Módulos `design-audit-*` | Evidência planejada/gerada/executada/aprovada | Modelar `TestEvidence` |
| 8 — Agentes e workflows | Em andamento | HAR-016 e HAR-017 | Event engine, adapters e endpoints | `orchestration.test.js` | Política por raia, skills, idempotência e aprovação | Integrar após Kanban |
| 9 — Design System | Validado no EP-12 | HAR-002 | Registry, extração, preview isolado, tokens, boilerplates, geração Vanilla/Angular/React, Studio e rastreabilidade | Marcos M1, M2 e M3 homologados | Hardening visual e evolução incremental dos kits | Integrar os consumidores dos demais épicos |
| 10 — Hardening | Em andamento | HAR-018 e HAR-019 | Testes focados e controles de segurança | `npm run check` passou em 437 JS e 10 JSON; 46 testes de EP-12.21 a 12.30 passaram | `npm run types` não está verde; faltam E2E/visual e estabilização da suíte integral | Corrigir o gate de tipos e executar aceite em navegador |

## Entrega atual

- Chat: inventário e modelos canônicos concluídos; apresentações compartilhadas já possuem implementação parcial, mas 02.03 a 02.08 ainda exigem histórias e aceite próprios.
- Prototype Engine: 32/32 histórias concluídas; renderer/inspetor, geração multiframework, integração com Studio, rastreabilidade e piloto DIS foram homologados.
- Projetos e workspaces: EP-04 concluído em 5/5 com seleção centralizada, persistência composta, quatro templates canônicos e guard de alterações não salvas.
- Scrum: EP-05 em 4/6; ordem e transições das 12 raias são persistidas com concorrência otimista e histórico, preservando a origem Jira.
- EP-12 encerrado pelo Marco M3; a evolução seguinte volta ao Chat Universal (EP-02) e aos módulos consumidores.
- Limitação transversal: validações unitárias e estruturais estão verdes nos recortes executados, mas o typecheck global e o aceite em navegador ainda não estão concluídos.

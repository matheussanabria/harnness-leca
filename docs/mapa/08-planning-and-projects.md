## 8. Planejamento da evolução do produto

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-evolution/README.md` | Índice, resumo executivo e checkpoint da Fase 0. |
| `docs/harness-evolution/01-current-state-audit.md` | Inventário da arquitetura, fluxos e restrições. |
| `docs/harness-evolution/02-requirements-and-gaps.md` | Problemas, evidências, soluções, riscos e validações. |
| `docs/harness-evolution/03-target-architecture.md` | Arquitetura-alvo, contratos e trade-offs. |
| `docs/harness-evolution/04-chat-studio-design-system.md` | Chat universal, Studio e foundations visuais. |
| `docs/harness-evolution/05-product-domains.md` | Kanban, Mapa, Componentes, Auditoria e AI-First. |
| `docs/harness-evolution/06-data-security-tests.md` | Migração/rollback, segurança e testes. |
| `docs/harness-evolution/07-roadmap-risks-acceptance.md` | Fases, riscos e critérios de aceite. |
| `docs/harness-evolution/08-prioritized-backlog.md` | HAR-001 a HAR-019 com escopo e validação. |
| `docs/PLAN-unificacao-atividade-interface-deploy.md` | Plano integrado das correções de Dashboard, Visão Geral, Diário e Deploy, com diagnóstico, fases, aceite, arquivos e testes. |
| `docs/harness-evolution/09-activity-interface-deploy-index.md` | Índice multiagente das correções: ondas paralelas, ownership exclusivo, dependências, gates, handoffs e estimativas por camada. |
| `docs/PLAN-commit-atomico.md` | Plano de fatiamento da worktree em 21 commits temáticos: diagnóstico, baseline, blocos, arquivos-hub, riscos e checkpoints. |
| `docs/harness-evolution/implementation-progress.md` | Controle vivo por fase, evidências, pendências e próximo passo. |
| `docs/harness-evolution/00-index.md` | Índice mestre do programa: 15 épicos (EP-00 a EP-14), dependências e backlog de entregas. |
| `docs/harness-evolution/01-architecture/` | Estado atual (foco no escritório), arquitetura-alvo da apresentação compartilhada e mapa de dependências. |
| `docs/harness-evolution/02-epics/EP-XX-*/README.md` | Objetivo, execução, entrega, aceite e histórias de cada épico (EP-00 a EP-12). |
| `docs/harness-evolution/02-epics/EP-05-scrum/05-dev-notas.md` | Arquitetura das fontes reais do DIS, decisões de proveniência e evidências de validação. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.01-migracao-compativel-status.md` | Contrato e aceite da migração versionada de status para raias. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.02-doze-raias-configuraveis.md` | História, critérios de aceite, arquitetura e evidências das 12 raias configuráveis. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.03-reordenacao-horizontal.md` | História, critérios de aceite e evidências da ordem persistida e concorrência otimista das raias. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.04-movimentacao-transicoes.md` | Contrato, critérios e evidências das transições auditáveis de histórias. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/05-dev-notas.md` | Decisões e evidências da seleção, persistência e templates de workspace. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.02-layouts-nomeados.md` | Contrato, aceite e evidências dos layouts nomeados publicados pelo Window Manager. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.03-persistencia-contexto-workspace.md` | Contrato e aceite do snapshot de janelas, filtros e recursos selecionados por projeto. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.04-templates-workspace.md` | Contrato e aceite dos quatro templates canônicos de workspace. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.05-protecao-alteracoes-nao-salvas.md` | Contrato, aceite e handoff do guard compartilhado de alterações não salvas. |
| `docs/harness-evolution/02-epics/EP-08-agentes/08.06-ui-workflows.md` | História da aba Workflows: catálogo, plano por etapa, dry run, execução e avanço/cancelamento (EP-08.06). |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/` | Dossiê da Central de Sessões: diagnóstico, reuso, capacidades, modelo canônico, workflow, eventos, UI, integração e roadmap. |
| `docs/harness-evolution/03-decisions/ADR-004-*.md` a `ADR-006-*.md` | Decisões propostas do registro canônico, persistência SQLite e estados ortogonais. |
| `docs/harness-evolution/04-test-plans/TP-09-central-sessoes.md` | Critérios de aceite e estratégia de testes da Central de Sessões e Orquestração. |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/` | EP-12 Prototype Engine & Design System Multiframework (README, arquitetura, contratos, fases F0-F7, histórias e relatórios F0). |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/05-dev-notas.md` | Notas consolidadas da implementação do EP-12, decisões preservadas, evidências dos Marcos M1-M3 e pendências transversais. |
| `docs/harness-evolution/02-epics/EP-00-auditoria/00.0X-*.md` e `EP-01-window-manager/01.XX-*.md` | Histórias no contrato padrão, prontas para detalhar. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.03-apresentacao-compacta.md` | Especificação e aceite da apresentação compacta (dock flutuante/PiP). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.04-apresentacao-lateral.md` | Especificação e aceite da apresentação lateral (sidebar do Studio e resizer). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.05-apresentacao-completa.md` | Especificação e aceite da apresentação completa (modal central e arena multi-motor). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.06-historico-continuidade.md` | Especificação e aceite de sessões multi-motor e modal de continuidade. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.07-rolagem-ancorada.md` | Especificação e aceite de rolagem ancorada e botões nas 3 apresentações. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.08-sincronizacao-estados.md` | Especificação e aceite de sincronização com estados reais de execução e hardening. |
| `docs/harness-evolution/02-epics/EP-01-window-manager/piloto-estacao-gemini.md` | Plano, aceite e riscos do piloto do Window Manager. |
| `docs/harness-evolution/02-epics/EP-01-window-manager/01.11-*.md`, `01.12-*.md` | Planned stories from the gap review: wire the Window Manager facade into the office (01.11) and multi-window host with docking (01.12). |
| `docs/harness-evolution/02-epics/EP-13-memoria-agentes/` | EP-13 Memória e conhecimento dos agentes: README, diagnóstico da memória atual (`00-diagnostico.md`), arquitetura-alvo em três camadas (`01-arquitetura-alvo.md`) e histórias 13.01 a 13.09. |
| `docs/harness-evolution/02-epics/EP-14-estado-das-telas/` | EP-14 Estado das telas persistido no servidor: README (decisões, ondas, branches) e 11 histórias (14.01 a 14.11) com a lista de arquivos que cada agente pode tocar. |
| `docs/ui/catalogo-de-telas.md` | Catálogo das 13 telas: escopo, rota, o que cada uma persiste, campos permitidos, chaves antigas migradas e exclusões justificadas (EP-14.04). |
| `docs/harness-evolution/03-decisions/ADR-009-memoria-um-fato-por-arquivo.md` | Decisão proposta: memória curada com um fato por arquivo, índice gerado e só a vitrine projetada para os motores. |
| `docs/harness-evolution/03-decisions/README.md` | Índice de ADRs. |
| `docs/harness-evolution/04-test-plans/README.md` | Índice de planos de teste e comandos. |
| `docs/harness-evolution/05-progress/progress.md` | Status real por épico (60/104) e registro de entregas. |
| `docs/harness-evolution/05-progress/multi-agent-sync.md` | Painel oficial de divisão, dependências e handoffs entre os chats Gemini/Antigravity e Codex. |
| `docs/harness-evolution/05-progress/epic-gaps.md` | Gap tracker per epic (claimed vs actual, 2026-10-24); generated by DeepSeek runs, spot-check before acting. |
| `docs/harness-evolution/_templates/` | Modelos de história, ADR e plano de teste. |
| `docs/handoff-pendencias-geral.md` | Handoff consolidado de pendências para outros motores: backlog de épicos, gaps de UI e programa de telemetria. |

---


## 9. Projeto 57multimarcas: configuração Maven local (`57multimarcas-api/`)

Fora deste repositório (workspace `C:/Users/matheuss.rodrigues/git/57multimarcas`). Serve para o build local não cair no proxy/Nexus da Procempa sem afetar o deploy da VPS.

| Caminho | Responsabilidade |
|---|---|
| `57multimarcas-api/settings-sandbox.xml` | Settings do Maven com repositórios públicos (sem o proxy empresarial). |
| `57multimarcas-api/.mvn/maven.config` | Local, ignorado pelo git e pelo Docker. Contém `-s settings-sandbox.xml` para todo `mvn`/`./mvnw` da máquina. |
| `57multimarcas-api/.dockerignore` | Impede que o `.mvn/maven.config` entre na imagem; o build da VPS usa o settings padrão. |
| `57multimarcas-api/.gitignore` | Ignora `.mvn/maven.config`. |

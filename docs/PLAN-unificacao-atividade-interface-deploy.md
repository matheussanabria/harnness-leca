---
titulo: Unificação de atividade, interface e deploy
status: indexado
data: 2026-10-19
escopo: Dashboard, Visão Geral, Diário e Deploy
indice_execucao: harness-evolution/09-activity-interface-deploy-index.md
---

# Plano de implementação — atividade, interface e deploy

> Execução multiagente, ownership de arquivos, ondas e handoffs: [índice de atividade, interface e deploy](harness-evolution/09-activity-interface-deploy-index.md).

## Resultado esperado e gate

Corrigir as falhas funcionais das quatro telas e fazer com que elas consumam os mesmos conceitos de motor, sessão e última atividade, sem criar uma nova persistência. A fonte canônica continua sendo `projects/<slug>/chats/*.md`; serviços compartilhados passam a normalizar sua leitura.

Este documento é o artefato de planejamento. Nenhuma implementação deve começar antes da aprovação do escopo e da ordem das fases.

## Evidências confirmadas

| Evidência | Impacto |
|---|---|
| O importador Codex existe, mas `tools/sync.js`, `tools/lib/sync-core.js` e `sync.controller.js` aceitam só Claude, Gemini e OpenCode. | A ausência do Codex nas telas nasce principalmente no fluxo de entrada. |
| O Dashboard já calcula `codexCount`, mas não oferece chip/botão Codex e renderiza motores desconhecidos como Claude. | O suporte atual é parcial e pode apresentar dados incorretos. |
| `daily-journal.js` ordena sessões por `inicio` crescente. | O Diário mostra `00h → 23h`, contrário ao requisito. |
| A Visão Geral agrega conversas sem distribuição por motor e mistura `mtime` do arquivo com `fim` do frontmatter para atividade. | Contagens e “última atividade” não têm um contrato único. |
| `global/deployments.json` tem 2 projetos/4 ambientes, e a API local os retorna. `deploy-render.js` usa `escapeAttr` sem importá-la. | A renderização quebra; persistência e GET não são a causa primária. |
| Os headers são independentes e três telas ainda usam emojis. | Há divergência visual e violação do padrão obrigatório de FontAwesome. |
| Os 18 testes direcionados de overview/servidor passaram. | O baseline está verde, mas não cobre Codex, Diário ou renderização do Deploy. |

O relatório informa 24 melhorias, porém enumera 23. Para fechar a rastreabilidade, o resumo diário derivado das conversas, recomendado na seção de UX, é tratado como o 24º item. O `AppShell` é a solução transversal para os dois requisitos explícitos de padronização de header.

## Decisões de arquitetura

1. Não criar banco ou repositório persistente novo nesta iniciativa. Os chats normalizados continuam como fonte de verdade.
2. Criar um serviço de leitura de atividade com contrato único: `sessionId`, `projectId`, `engine`, `title`, `startedAt`, `lastActivityAt`, `messageCount`, `extractionStatus` e `sourceFile`.
3. Calcular `lastActivityAt` a partir de `fim`; usar `mtime` somente como fallback explícito.
4. Separar `extractionStatus` (`nova`, `alterada`, `ok`) de estado de execução. Não inferir planejamento, implementação ou testes a partir da extração.
5. Centralizar metadados dos motores — ID, nome, cor, ícone FontAwesome e capacidade de sync — e remover arrays duplicados.
6. Tratar HTTP 2xx do webhook como `accepted`, não como deploy concluído. Estados posteriores dependem de integração real com o provedor.
7. Decompor o controller de Deploy antes de acrescentar regras: ele já possui 279 linhas.

## Backlog consolidado

| Lote | Prioridade | Entrega | Aceite principal | Dependência |
|---|---|---|---|---|
| HL-01 | P0 | Hotfix de renderização do Deploy | Os 2 projetos e 4 ambientes persistidos aparecem sem erro JS. | Nenhuma |
| HL-02 | P0 | Codex no sync global e por projeto | `codex` e `all` descobrem sessões por `cwd`, associam projeto, deduplicam e respeitam `dry-run`. | Nenhuma |
| HL-03 | P0 | Contrato compartilhado de atividade | Dashboard, Visão Geral e Diário recebem motor e timestamps com a mesma semântica. | HL-02 |
| HL-04 | P0 | `AppShell` global | As quatro telas usam navegação responsiva, estado ativo e apenas FontAwesome. | Nenhuma |
| HL-05 | P0/P1 | Diário corrigido | Filtros dos 4 motores, ordem `23h → 00h`, agrupamento por dia/motor, busca e expansão. | HL-02, HL-03, HL-04 |
| HL-06 | P0/P1 | Dashboard e Visão Geral coerentes | Codex aparece em filtros/contagens; última atividade usa `lastActivityAt`; saúde do sync é explícita. | HL-02, HL-03, HL-04 |
| HL-07 | P1/P2 | Operação de Deploy | Pipeline, ambiente, execução e webhook são distintos; histórico, feedback, filtros e confirmação de produção funcionam. | HL-01, decomposição do controller |
| HL-08 | P2 | Produtividade e ações em lote | Métricas por período e filtros/lotes usam o contrato canônico, sem dados fictícios. | HL-03, HL-05, HL-06 |

## Fases de execução

### Fase 0 — Caracterização e proteção

- Criar testes que reproduzam o grid vazio do Deploy, a omissão do Codex e a ordem do Diário.
- Registrar fixtures sem URLs, tokens ou dados reais.
- Fixar timezone e regra de fallback de `lastActivityAt` nos testes.
- Confirmar o baseline com `npm test` e `npm run check`.

Saída: falhas atuais reproduzidas por testes vermelhos, sem alterar contratos.

### Fase 1 — P0 funcional

- Importar `escapeAttr` corretamente no renderer do Deploy.
- Implementar descoberta Codex no sync global e por projeto usando os matchers/aliases existentes.
- Aceitar Codex nas APIs e incluir o motor nos controles das telas.
- Corrigir o renderer do Dashboard para nunca classificar Codex como Claude.
- Ordenar sessões do Diário por `inicio` decrescente dentro de cada dia.

Saída: pipelines configuradas visíveis e Codex percorrendo ingestão → API → telas.

### Fase 2 — Modelo compartilhado de atividade

- Extrair serviço pequeno de atividade e metadados, sem nova persistência.
- Fazer `project.service.js`, Overview e Diário consumirem o contrato comum.
- Expor distribuição por motor, última atividade e saúde do sync por projeto/motor.
- Preservar `extractionStatus` como dimensão independente.

Saída: uma sessão produz os mesmos motor, horário e status de extração em todos os consumidores.

### Fase 3 — `AppShell` e telas de atividade

- Criar shell e CSS compartilhados, com navegação ativa e responsiva.
- Extrair CSS/JS inline do Diário para módulos focados.
- Aplicar filtro canônico de motores, busca por conteúdo/projeto/período e expansão de sessão.
- Gerar um resumo diário determinístico a partir das conversas reais, preservando acesso ao conteúdo original.
- Exibir data relativa no Dashboard (`agora`, minutos, horas, ontem ou data completa).
- Incluir indicadores consolidados e saúde de sync na Visão Geral.

Saída: quatro headers consistentes; Diário, Dashboard e Visão Geral coerentes e acessíveis por teclado.

### Fase 4 — Deploy operacional

- Separar configuração, validação, disparo e histórico em serviços/controladores coesos.
- Modelar estados `requesting`, `accepted`, `rejected`, `running`, `succeeded`, `failed` e `unknown`.
- Organizar cards por projeto/ambiente e adicionar filtros.
- Adicionar feedback de execução, duração e logs somente quando houver fonte real.
- Exigir confirmação para produção e validar permissão no servidor.
- Não devolver segredos de webhook ao browser; apresentar apenas versão mascarada.

Saída: o painel não confunde aceitação do webhook com sucesso da pipeline e protege ações críticas.

### Fase 5 — P2 e regressão

- Adicionar filtros/lotes de projetos e produtividade por período.
- Validar navegação rápida para conversa e Escritório.
- Executar testes completos, acessibilidade, responsividade e comparação visual.
- Atualizar documentação, `MAPA.md` e progresso dos épicos relacionados.

Saída: requisitos P2 entregues sem regressão dos fluxos P0/P1.

## Arquivos impactados

### Existentes

- Sync: `tools/sync.js`, `tools/lib/sync-core.js`, `tools/import-codex-chats.js`, `ui/server/controllers/sync.controller.js`.
- Atividade/API: `tools/daily-journal.js`, `ui/server/services/project.service.js`, `ui/server/controllers/project.controller.js`, `ui/server/controllers/overview.controller.js`.
- Dashboard: `ui/public/index.html`, `ui/public/js/modules/projects-chat-filters.js`, `projects-chat-render.js` e `projects-sync.js`.
- Visão Geral: `ui/public/overview.html`, `ui/public/js/overview.js`, `ui/public/css/overview.css`.
- Diário: `ui/public/diario.html`.
- Deploy: `ui/public/deploy.html`, `ui/public/js/deploy/*`, `ui/server/controllers/deploy.controller.js`, `ui/public/css/deploy/*`.
- Governança: `MAPA.md` e documentação de EP-09, EP-10 e EP-11.

### Novos previstos

- `ui/server/services/activity.service.js` e, se necessário, `activity-metadata.js`.
- `ui/public/js/shared/engine-catalog.js`.
- `ui/public/js/shared/app-shell.js` e `ui/public/css/app-shell.css`.
- `ui/public/js/diario/` e `ui/public/css/diario.css`.
- Testes focados em sync Codex, Diário, Dashboard, Deploy e `AppShell`.

Os nomes finais podem ser ajustados na implementação, mantendo SRP e o teto de 250–300 linhas.

## Estratégia de testes

| Camada | Cobertura mínima |
|---|---|
| Importação/sync | descoberta por `cwd`, aliases, deduplicação, global/projeto, `all`, `codex` e `dry-run` |
| Atividade | quatro motores, `fim` vs. `mtime`, timezone, contagem e status de extração |
| Diário | dias decrescentes, sessões `23h → 00h`, busca, período, motor e expansão |
| Dashboard | chip, contador e badge Codex; ordenação; data relativa; navegação |
| Visão Geral | contagem por motor, saúde de sync e coerência com Dashboard |
| Deploy | configuração preenchida/vazia, erro de API, cards, confirmação e estados da execução |
| Shell/UI | rota ativa, teclado, foco, viewport móvel, FontAwesome e ausência de emojis nas telas tocadas |
| Regressão | `npm test`, `npm run check` e comparação visual das quatro telas |

## Riscos e mitigação

- Associação Codex incorreta: reutilizar `projectFromPath` e aliases, testar caminhos ambíguos e não importar tudo sem seleção.
- Duplicação de sessão: preservar `sessionId`/`sourceId` estável e cobrir reimportação idempotente.
- Reordenação inesperada de projetos: publicar a nova semântica temporal e testar timezone/fallback.
- Segredos de Deploy: nunca copiar valores reais para fixtures, logs ou respostas; mascarar e validar no servidor.
- Escopo visual crescer demais: entregar primeiro o shell e componentes mínimos; produtividade e ações em lote ficam na Fase 5.
- Status enganoso: exibir `unknown` quando não houver integração de acompanhamento, nunca inferir sucesso.
- Monólitos: dividir Diário e Deploy antes de acrescentar comportamento; nenhum arquivo de código novo acima do teto.

## Definition of Done

- Os 24 itens — 23 enumerados mais o resumo diário recomendado — têm teste ou evidência de aceite.
- Codex é sincronizável e aparece coerentemente nas três telas de atividade.
- Pipelines persistidas são exibidas sem fallback fictício.
- Última atividade tem uma única regra em todas as telas.
- Produção exige confirmação e autorização no servidor.
- A UI tocada não contém emojis e usa FontAwesome.
- `npm test` e `npm run check` passam; `MAPA.md` e documentação relacionada estão atualizados.

## Gate de aprovação

Após aprovação, executar primeiro Fase 0 + Fase 1 em um lote pequeno e verificável. As Fases 2–5 só avançam após demonstração dos P0: Deploy renderizando, Codex sincronizado e Diário em ordem decrescente.

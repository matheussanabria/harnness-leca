---
id: TP-09
escopo: Central de sessões, observabilidade e orquestração
historias: [09.01, 09.02, 09.03, 09.04, 09.05]
tags: [harness-evolution, plano-de-teste, sessoes]
---

# TP-09: Central de sessões, observabilidade e orquestração

## Objetivo

Comprovar identidade, persistência, capacidades, estados ortogonais, recuperação SSE, continuidade de conversa, aprovações e integração visual sem regressão dos históricos existentes.

## Escopo

Inclui descoberta dos quatro motores, registro e migração, projetores, consultas, lista, Kanban, Chat, Window Manager, Escritório e caixa de atenção.

Exclui controle de processos externos, APIs não verificadas dos provedores, conteúdo semântico das respostas dos modelos e infraestrutura distribuída.

## Critérios de entrada

- ADRs aceitos ou revisados;
- contratos versionados;
- fixtures sanitizadas dos quatro motores;
- migração e rollback implementados;
- testes legados passando antes da mudança;
- ambiente local sem credenciais reais nas fixtures.

## Baseline observado em 2026-10-19

- 468/468 testes aprovados na suíte completa;
- 7/7 testes Claude aprovados, incluindo `killTree` no Windows;
- os 6 testes focados de orquestração passam;
- o check estrutural aprova 456 JavaScript e 10 JSON;
- a tipagem estática permanece vermelha por dívida preexistente, sem erro nos arquivos deste incremento;
- o sync real seguido de dry-run confirma Claude 0/0/109 e Gemini 0/0/71.

## Estratégia

| Nível | Foco | Justificativa |
|---|---|---|
| Unitário | normalização, identidade, capacidades, transições e projetores | Maioria das regras é determinística |
| Integração | SQLite, adaptadores, migração, queries, SSE e aprovações | Prova fronteiras e persistência real |
| E2E | descoberta até abertura/retomada, Kanban e aprovação | Reservado aos fluxos críticos do operador |
| Visual/a11y | lista, Kanban, detalhe, taskbar e Escritório | Prova paridade, teclado e responsividade |
| Performance | indexação, filtros e fan-out SSE | Valida metas locais declaradas |

## Dados de teste

- JSONL Claude com sessão raiz, sidechain, tool e falha;
- transcript Gemini concluído, com erro e subagente;
- SQLite OpenCode com pai/filho e timestamps em segundos/milissegundos;
- JSONL Codex com UUID, cwd, mensagens e falha;
- Markdown legado, Codex, comparativo e sem `sessao`;
- permissões pendente, resolvida, expirada e duplicada;
- associações de projeto explícita, inferida, conflitante e ausente.

## Casos de teste

| ID | Categoria | Cenário | Nível | Resultado esperado |
|---|---|---|---|---|
| TP09-01 | Happy | Descobrir sessões dos quatro motores | Integração | Registros idempotentes preservam IDs e origem |
| TP09-02 | Borda | Mesmo título, data ou ID nativo em dois motores | Unitário | Origens são preservadas por `(provider, nativeSessionId)` e não há sobrescrita |
| TP09-03 | Borda | Projeto inferido com baixa confiança | Integração | Sessão fica candidata, sem associação silenciosa |
| TP09-04 | Falha | Fonte ausente ou corrompida | Integração | Demais fontes continuam; erro vira atenção |
| TP09-05 | Happy | Reiniciar servidor após ingestão | Integração | Sessões, eventos e cursor permanecem |
| TP09-06 | Borda | Reingerir o mesmo fato | Unitário | Evento duplicado não altera projeção |
| TP09-07 | Happy | Receber mudança posterior da mesma sessão | Integração | Novo evento atualiza projeção sem ser descartado |
| TP09-08 | Falha | SSE desconecta entre dois eventos | Integração | Reconexão recupera deltas pelo cursor |
| TP09-09 | Happy | Filtrar por projeto, motor, workflow e atenção | Integração/UI | Resultado e contadores são coerentes |
| TP09-10 | Borda | Sessão sem projeto | UI | Visível no escopo global e identificada como não associada |
| TP09-11 | Happy | Mover cartão para aprovação | E2E | Somente workflow muda; execução permanece intacta |
| TP09-12 | Falha | Transição inválida de workflow | Unitário/API | Operação rejeitada sem alterar projeção |
| TP09-13 | Happy | Retomar Claude e Codex com UUID válido | E2E | Adaptador recebe ID nativo correto |
| TP09-14 | Happy | Retomar OpenCode disponível | E2E | Sessão existente é usada; fallback é informado se necessário |
| TP09-15 | Borda | Continuar Gemini API | E2E | UI diz “continuar com contexto”, não “retomar” |
| TP09-16 | Falha | Tentar cancelar sessão externa | API/UI | Ação desabilitada e backend rejeita tentativa forjada |
| TP09-17 | Happy | Aprovação Claude pela Central | E2E | Decisão desbloqueia pedido e gera auditoria |
| TP09-18 | Falha | Aprovação expirada ou já respondida | API | Resposta rejeitada de modo idempotente |
| TP09-19 | Borda | Fechar janela com aprovação pendente | Integração | Pedido segue na fila até decisão ou timeout |
| TP09-20 | Happy | Restaurar workspace com sessão selecionada | E2E | Janela consulta estado atual pelo ID canônico |
| TP09-21 | Falha | Banco indisponível ou migração inválida | Integração | Inicialização segura, sem reescrever fontes |
| TP09-22 | Segurança | Título/payload contém HTML e caminho sensível | UI/API | Conteúdo escapado e caminho redigido |
| TP09-23 | A11y | Operar filtros, Kanban e detalhe por teclado | E2E/a11y | Fluxo completo sem mouse e foco previsível |
| TP09-24 | Visual | Viewports e modos do Escritório | Visual | Sem perda de ações ou sobreposição crítica |
| TP09-25 | Performance | 1.000 sessões e filtros combinados | Performance | p95 local abaixo de 500 ms |
| TP09-26 | Regressão | Executar sync completo e repeti-lo em dry-run | Integração | Segunda execução informa zero criações/atualizações e mantém contagens por motor |

## Matriz de critérios

| Critério do épico | Casos |
|---|---|
| Descoberta e consolidação | TP09-01 a TP09-07, TP09-26 |
| Pesquisa e filtros | TP09-09, TP09-10, TP09-25 |
| Workflow e Kanban | TP09-11, TP09-12, TP09-23 |
| Navegação e retomada | TP09-13 a TP09-16, TP09-20 |
| Bloqueios, falhas e atenção | TP09-04, TP09-08, TP09-21 |
| Aprovações e notificações | TP09-17 a TP09-19 |
| Segurança e compatibilidade | TP09-02, TP09-21, TP09-22 |
| Escritório e Window Manager | TP09-20, TP09-23, TP09-24 |

## Ambiente

- Node.js suportado pelo projeto, com `node:sqlite`;
- servidor iniciado por `npm run ui`;
- viewports: 1920x1080, 1366x768, 1024x768, 768x1024, 414x896 e 375x667;
- modos do Escritório: 3D, diorama e 2.5D;
- fontes dos motores substituídas por diretórios/bancos temporários nos testes.

## Critérios de saída

- todos os casos obrigatórios executados e associados a evidências;
- zero falhas críticas ou perda de histórico;
- testes de migração e rollback aprovados;
- nenhum estado/capacidade apresentado sem prova correspondente;
- metas de consulta e atualização atendidas;
- navegação por teclado e alternativa ao drag and drop aprovadas;
- suíte legada permanece verde.

## Riscos de teste

- CLIs mudam formatos: fixtures versionadas e testes de contrato por motor;
- relógio/`mtime` causa flakiness: relógio injetável e timestamps fixos;
- testes acionam motores reais: adaptadores recebem caminhos/URLs substituíveis;
- teste de orquestração altera projetos: operações mutáveis usam workspace temporário e mocks.
- encerramento de árvore varia por sistema operacional: estratégia única, resultado observável e cleanup garantido no `after` do teste.

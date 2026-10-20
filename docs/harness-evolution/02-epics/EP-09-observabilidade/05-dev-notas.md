# Notas de desenvolvimento — hardening anterior à 09.01

## Escopo entregue

- identidade de chats materializados passou de `sessionId` isolado para `(agente, sessionId)`;
- colisões de nome entre motores recebem sufixo de agente sem renomear históricos que não colidem;
- sessões Claude repetidas em workspaces diferentes são reconciliadas antes da importação;
- `killTree` do Claude reutiliza a implementação central do gerenciador de processos;
- teste de processos sempre executa cleanup, inclusive quando uma asserção falha.

## Arquivos principais

- `tools/lib/chat-store.js`: preservação de representações por motor;
- `tools/lib/claude-sync-sources.js`: seleção determinística da fonte Claude;
- `tools/sync.js` e `tools/lib/sync-core.js`: reconciliação aplicada aos dois caminhos de sync;
- `tools/import-claude-code-chats.js`: filtro opcional por sessões selecionadas;
- `tools/lib/engines/claude.js` e `tools/lib/proc-manager-core.js`: encerramento único da árvore de processos;
- `tests/lib.test.js`, `tests/importers.run.test.js` e `tests/engines.claude.test.js`: regressões.

## Decisões

1. O Markdown continua compatível; nenhuma migração destrutiva ou renomeação em massa foi criada.
2. A seleção de fontes Claude usa, nesta ordem, `mtime`, tamanho e caminho lexical.
3. Arquivo legado sem `agente` continua compatível e é associado pela sessão.
4. A correspondência entre motores preserva duas representações; fusão semântica ficará para o registro canônico da 09.01.

## Evidências

- testes focados: 23/23 aprovados;
- suíte global: 468/468 aprovada;
- check estrutural: 456 JavaScript e 10 JSON aprovados;
- sync real: 180 conversas materializadas;
- dry-run posterior: Claude 0 novas/0 atualizadas/109 iguais; Gemini 0/0/71;
- tipagem: nenhum erro nos arquivos alterados; o comando global segue vermelho pelo backlog existente.

## Pendências

- implementar portas de descoberta e o registro canônico da 09.01;
- decidir como o registro relacionará duas representações do mesmo diálogo sem fundi-las automaticamente;
- tratar o backlog global de tipagem em iniciativa própria.

Não há mocks ou APIs provisórias neste incremento.

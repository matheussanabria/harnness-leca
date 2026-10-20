---
tags: [harness-evolution, adr, coordenacao, agentes]
status: aceita
data: 2026-10-19
---

# ADR-007: ledger local para coordenação entre provedores

## Contexto

Gemini, Codex, Claude e OpenCode podem atuar em chats e processos separados. Documentos Markdown mantidos manualmente não oferecem exclusão mútua, idempotência, lease de posse nem entrega confiável de handoffs. A divisão atual autoriza somente Gemini e Codex, mas os demais motores devem continuar representados no modelo.

## Decisão

Adotar um ledger JSON local por projeto como fonte canônica, alterado exclusivamente pela CLI `tools/coordination.js`. Cada mutação:

1. adquire lock local com recuperação de lock obsoleto;
2. valida política do provedor, responsável, dependências e lease;
3. aplica um evento idempotente e incrementa a revisão;
4. grava o estado atomicamente;
5. registra auditoria JSONL por origem;
6. regenera dashboard, contexto e caixas de entrada.

Gemini e Codex ficam ativos. Claude e OpenCode ficam cadastrados e inativos. `autoDispatch` permanece desligado para todos: automação significa sincronizar estado e comunicação por inbox, não iniciar processos de IA sem autorização.

## Alternativas consideradas

### Mensagens diretas entre CLIs

Rejeitada porque exige que o processo destinatário esteja disponível, acopla formatos de sessão e dificulta repetição segura.

### Apenas Markdown compartilhado

Rejeitada como fonte canônica porque edições simultâneas geram conflito e não fornecem validação transacional. Markdown continua como projeção legível.

### Banco SQLite desde o início

Adiada. É apropriado para telemetria volumosa do EP-09, mas adiciona migração e operação desnecessárias ao backlog atual de 104 itens. O contrato de eventos permite migração posterior.

## Consequências

- Agentes precisam reivindicar a história antes de editar e publicar evidência ao concluir.
- Handoffs aparecem automaticamente na caixa do destinatário.
- Operações de provedores inativos falham de forma explícita.
- O ledger não executa provedores; um adaptador futuro poderá observar inboxes quando o usuário habilitar `autoDispatch`.

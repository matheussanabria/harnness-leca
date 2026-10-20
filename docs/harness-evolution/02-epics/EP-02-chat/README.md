---
id: EP-02
titulo: Chat universal e conversas
prioridade: P0
status: concluido
depende: [EP-00, EP-01]
tags: [harness-evolution, epico]
---

# EP-02: Chat universal e conversas

[Voltar ao índice](../../00-index.md)

## Objetivo
Compartilhar o mesmo núcleo de chat entre Central, Studio e Escritório.

## Execução
Identificar lógica duplicada; separar mensagens, sessões e execuções; criar apresentações compacta, lateral e completa; histórico por motor, continuidade, rolagem na última mensagem e sincronização com estados reais.

## Entrega
Chat consistente e interativo em todos os contextos.

## Aceite do épico
A mesma conversa pode ser acessada de diferentes interfaces sem duplicação de dados ou perda de histórico. Portão satisfeito com 8/8 histórias aceitas.

## Contexto conhecido
Parte já está em andamento na Fase 1 (HAR-003 a HAR-005, HAR-007): apresentações declarativas e execuções isoladas por projeto e conversa. Ver [implementation-progress](../../implementation-progress.md).

## Histórias
Todas as histórias 02.01 a 02.08 estão aceitas e testadas.

| ID | Título |
|---|---|
| [02.01](02.01-inventario-chat.md) | Inventário da lógica de chat duplicada |
| [02.02](02.02-modelo-mensagens.md) | Modelo separado de mensagens, sessões e execuções |
| [02.03](02.03-apresentacao-compacta.md) | Apresentação compacta |
| [02.04](02.04-apresentacao-lateral.md) | Apresentação lateral |
| [02.05](02.05-apresentacao-completa.md) | Apresentação completa |
| [02.06](02.06-historico-continuidade.md) | Histórico por motor e continuidade de conversa |
| [02.07](02.07-rolagem-ancorada.md) | Rolagem ancorada na última mensagem |
| [02.08](02.08-sincronizacao-estados.md) | Sincronização com estados reais de execução e hardening |

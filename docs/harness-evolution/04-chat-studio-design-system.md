# Chat, Studio e Design System

## Chat universal

Preservar `chat.js` como fachada. Extrair de `chat-ui-interaction.js` um controlador configurado por `ChatPresentation`; manter wrappers antigos até a migração completa.

1. Caracterizar modal, Studio e miniwidget.
2. Centralizar abrir/fechar, clique externo, Escape e foco.
3. Consolidar store por `chatId + projectSlug`.
4. Migrar modal, Studio e miniwidget nessa ordem.
5. Remover wrappers após paridade.

Uploads, skills, memórias, permissões, comparação e DAI são capabilities do mesmo composer. Contexto via referências validadas; o servidor resolve somente campos autorizados.

## Studio

- Reusar Chat Core/UI com adapter embedded.
- Pointer Events e ajuste por teclado.
- Transformar 300/850 px e breakpoint 768 px em tokens.
- Persistir proporção com clamp em outra tela.
- Não recarregar iframe ao redimensionar; alternar preview/chat se estreito.
- `ResizeObserver` só para apresentação; conversa independe do tamanho.

## Foundations

Consolidar escala de espaçamento/tipografia; foco; camadas nomeadas; breakpoints 375, 640, 768, 1024, 1440 e 1920; limites de painel; alvos de toque; status não dependentes só de cor.

Prioridade: Button, IconButton, Popover, Modal, Drawer, Tabs, SplitPanel, ChatHeader, ChatComposer, KanbanLane e StoryCard. Reusar partials/estilos que passarem nos critérios.

## Aceite

- Escape fecha só a camada superior e devolve foco.
- Clique fora fecha; interação interna não.
- Um menu aberto por apresentação.
- Histórico, streaming e rascunho sobrevivem à troca de layout.
- Resize funciona com mouse, toque e teclado, sem recarregar preview.
- Nenhum controle crítico sai das seis viewports.
- Chats simultâneos não misturam sessão, abort controller, anexos ou contexto.


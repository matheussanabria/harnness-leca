---
domain: frontend
module: coverage
feature: inspector-ui
summary: Studio inspector bridge, iframe events, component card, diff, editing and state.
paths: [ui/public/js/modules/inspector-bridge.js, ui/public/js/modules/inspector-card.js, ui/public/js/modules/inspector-diff.js, ui/public/js/modules/inspector-dom.js, ui/public/js/modules/inspector-ds-classes.js, ui/public/js/modules/inspector-edit-panel.js, ui/public/js/modules/inspector-iframe.js, ui/public/js/modules/inspector-mode.js, ui/public/js/modules/inspector-store.js]
keywords: [inspector, studio, iframe, components, edit]
updated: 2026-11-16
---
# Studio Inspector UI / Interface do Inspetor do Studio

| File | Responsibility |
|---|---|
| `ui/public/js/modules/inspector-bridge.js` | Builds the safe script copied into the inspected app's DevTools. / Monta o script seguro para colar no DevTools do app inspecionado. |
| `ui/public/js/modules/inspector-card.js` | Renders selected component details, context and actions. / Renderiza detalhes, contexto e ações do componente selecionado. |
| `ui/public/js/modules/inspector-diff.js` | Renders unified diffs and manages the undo banner. / Renderiza diffs unificados e gerencia o aviso de desfazer. |
| `ui/public/js/modules/inspector-dom.js` | Reads the same-origin Studio iframe and selected element data. / Lê o iframe de mesma origem do Studio e dados do elemento selecionado. |
| `ui/public/js/modules/inspector-ds-classes.js` | Loads Design System classes and provides class suggestions. / Carrega classes do Design System e oferece sugestões. |
| `ui/public/js/modules/inspector-edit-panel.js` | Renders the direct-edit panel for inspected elements. / Renderiza o painel de edição direta dos elementos inspecionados. |
| `ui/public/js/modules/inspector-iframe.js` | Attaches selection events and overlays inside the iframe. / Anexa eventos de seleção e overlays dentro do iframe. |
| `ui/public/js/modules/inspector-mode.js` | Controls inspector activation, message listener and component search. / Controla ativação, listener de mensagens e busca de componentes do inspetor. |
| `ui/public/js/modules/inspector-store.js` | Holds shared mutable inspector state. / Mantém o estado mutável compartilhado do inspetor. |

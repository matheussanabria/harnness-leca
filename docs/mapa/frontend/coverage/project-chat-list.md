---
domain: frontend
module: coverage
feature: project-chat-list
summary: Project chat loading, filtering, rendering, persisted state and engine synchronization.
paths: [ui/public/js/modules/projects-chat-actions.js, ui/public/js/modules/projects-chat-filters.js, ui/public/js/modules/projects-chat-render.js, ui/public/js/modules/projects-load.js, ui/public/js/modules/projects-store.js, ui/public/js/modules/projects-sync.js]
keywords: [projects, chats, filters, list, sync]
updated: 2026-11-16
---
# Project Chat List / Lista de Conversas do Projeto

| File | Responsibility |
|---|---|
| `ui/public/js/modules/projects-chat-actions.js` | Applies chat engine/group filters, view mode and pagination actions. / Aplica filtros por motor/grupo, modo de visualização e paginação. |
| `ui/public/js/modules/projects-chat-filters.js` | Renders filter counts/chips and filters/sorts chats. / Renderiza contagens/chips e filtra/ordena conversas. |
| `ui/public/js/modules/projects-chat-render.js` | Renders chat table/list and empty states. / Renderiza tabela/lista de conversas e estados vazios. |
| `ui/public/js/modules/projects-load.js` | Loads a project and its file mapping while isolating active chat state. / Carrega projeto e mapeamento de arquivos isolando o estado do chat ativo. |
| `ui/public/js/modules/projects-store.js` | Holds shared mutable project screen state. / Mantém o estado mutável compartilhado da tela de projetos. |
| `ui/public/js/modules/projects-sync.js` | Syncs project chats from engines and opens project files. / Sincroniza conversas dos motores e abre arquivos do projeto. |

---
domain: frontend
module: coverage
feature: engine-group-ui
summary: Engine group classification, assignment, management and persistence UI modules.
paths: [ui/public/js/modules/groups-assign.js, ui/public/js/modules/groups-classify.js, ui/public/js/modules/groups-data.js, ui/public/js/modules/groups-manage.js, ui/public/js/modules/groups-store.js, ui/public/js/modules/groups.js]
keywords: [groups, classification, assignment, engines, chats]
updated: 2026-11-16
---
# Chat Groups UI / Interface de Grupos de Conversas

| File | Responsibility |
|---|---|
| `ui/public/js/modules/groups-assign.js` | Assigns chats to groups and requests individual suggestions. / Atribui conversas a grupos e solicita sugestões individuais. |
| `ui/public/js/modules/groups-classify.js` | Loads and applies batch auto-classification suggestions. / Carrega e aplica sugestões de classificação automática em lote. |
| `ui/public/js/modules/groups-data.js` | Reads and saves project groups and chat assignments. / Lê e salva grupos do projeto e atribuições de conversas. |
| `ui/public/js/modules/groups-manage.js` | Manages group/subgroup dialogs, colors and list actions. / Gerencia diálogos de grupos/subgrupos, cores e ações da lista. |
| `ui/public/js/modules/groups-store.js` | Holds shared mutable group UI state. / Mantém o estado mutável compartilhado da interface de grupos. |
| `ui/public/js/modules/groups.js` | Public facade re-exporting the group module API. / Fachada pública que reexporta a API dos módulos de grupos. |

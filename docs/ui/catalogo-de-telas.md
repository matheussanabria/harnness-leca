# Catálogo de telas e estado persistido

Fonte canônica: `ui/server/services/screen-state/registry.js` (EP-14.04). Este documento descreve o
contrato do registro e o que cada tela persiste. Alterou o registro, atualize as duas pontas.

## Contrato

Cada tela é declarada com:

- `id`: identificador usado na rota `/api/screens/:id/state`.
- `escopo`: `projeto` (arquivo em `projects/<slug>/ui-state/`) ou `global` (`global/ui-state/`).
- `campos`: campos permitidos, com `tipo` (`string`, `number`, `boolean`, `array` ou `object`) e
  `limite` (caracteres para texto, valor máximo para número, itens para lista e bytes para objeto).
- `migraDe`: padrões das chaves antigas do `localStorage`. O `*` no fim representa sufixo variável
  (slug do projeto, id do protótipo ou id da tela).

Regras aplicadas pelo serviço e pelo cliente:

- Campo fora de `campos` é descartado.
- Valor com tipo errado, acima do `limite` ou abaixo do mínimo numérico é descartado.
- O estado saneado não pode passar de **64 KB**; acima disso a gravação é recusada.
- A migração lê as chaves de `migraDe`, envia o que reconhece e remove a chave antiga.

## As 13 telas

| Tela | `id` | Escopo | Rota | O que persiste |
|---|---|---|---|---|
| Conversas | `chats` | projeto | `/?p=<slug>` | Modo de visualização, página, filtros, busca, ordenação, rascunho, grupos, atribuições, motor/modelos e aba/filtros de skills. |
| Studio | `studio` | projeto | `/?p=<slug>&studio=1` | Visualização ativa, largura da sidebar, coluna de código (aberta e largura), viewport, rota, dock, protótipo/tela ativos e view aberta do Design. |
| Ateliê de Protótipos | `prototypes` | projeto | `/?p=<slug>&view=atelier` | Protótipo e tela ativos, nó selecionado, inspetor ligado, layout dos quatro painéis e documento do canvas. |
| Scrum | `scrum` | projeto | `/?p=<slug>&view=scrum` | Sprint, filtro, história selecionada, aba, ordenação, épico, responsável e somente impedimentos. |
| Mapa em Camadas | `layers` | projeto | `/?p=<slug>&view=layers` | Filtro de componente, camada selecionada, aba, nós expandidos, zoom, tela ativa, campo focado, filtro de foco e viewport. |
| Quadro | `board` | projeto | `/?p=<slug>&view=board` | Sprint, filtro, cartão selecionado, agrupamento e zoom. |
| Auditoria | `audit` | projeto | `/?p=<slug>&view=audit` | Filtros de componente e matriz, componente selecionado, aba, severidade e estado da evidência. |
| Artefatos | `artifacts` | projeto | `/?p=<slug>&view=artifacts` | Filtros de tipo e acesso, busca, artefato selecionado e ordenação. |
| Rotinas | `routines` | projeto | `/?p=<slug>&view=routines` | Filtro, rotina selecionada, filtro de aprovação e aba. |
| Visão Geral | `overview` | global | `/overview` | Busca, ordenação, página e tamanho da página da lista de projetos. |
| Escritório Virtual | `office` | global | `/office` | HUD, sensibilidade do mouse, preferências de cena, modo de visualização, layout/estado das janelas e workspaces. |
| Deploy | `deploy` | projeto | `/?p=<slug>&view=deploy` | Ambiente, pipeline, configuração, histórico exibido, execução selecionada e aba. |
| Diário | `diario` | global | `/diario` | Projeto, busca, filtro de motor, intervalo de datas, ordenação, página, tamanho da página e mostrar encerrados. |

## Campos permitidos por tela

| Tela | Campos (`nome`: tipo, limite) |
|---|---|
| `chats` | `viewMode`: texto, 16; `pageSize`: número, 100; `page`: número, 100.000; `engineFilter`: texto, 32; `groupFilter`: texto, 120; `subgroupFilter`: texto, 120; `searchQuery`: texto, 200; `sortField`: texto, 32; `sortAsc`: booleano; `draft`: texto, 20.000; `groups`: lista, 200; `assignments`: objeto, 60.000 bytes; `engineSettings`: objeto, 8.192 bytes; `skillSubTab`: texto, 16; `skillImportFilter`: texto, 200; `skillImportSource`: texto, 32. |
| `studio` | `activeView`: texto, 32; `sidebarWidth`: número, 160 a 720; `sourceOpen`: booleano; `sourceWidth`: número, 160 a 720; `viewport`: texto, 16; `route`: texto, 300; `dockMaximized`: booleano; `activePrototype`: texto, 120; `activeScreen`: texto, 120; `designView`: texto, 32; `designOpen`: booleano. |
| `prototypes` | `activePrototype`: texto, 120; `activeScreen`: texto, 120; `selectedNode`: texto, 120; `inspector`: booleano; `workspaceLayout`: objeto, 8.192 bytes; `canvas`: objeto, 32.768 bytes; `viewport`: texto, 16. |
| `scrum` | `sprint`: texto, 120; `filter`: texto, 120; `selectedStory`: texto, 120; `tab`: texto, 32; `sortField`: texto, 32; `sortAsc`: booleano; `epicFilter`: texto, 120; `assigneeFilter`: texto, 120; `onlyImpediments`: booleano. |
| `layers` | `componentFilter`: texto, 120; `selectedLayer`: texto, 120; `tab`: texto, 32; `expanded`: lista, 500; `zoom`: número, 25 a 200; `activeScreen`: texto, 120; `focusedField`: texto, 120; `filterOnlyFocused`: booleano; `viewport`: texto, 16. |
| `board` | `sprint`: texto, 120; `filter`: texto, 120; `selectedCard`: texto, 120; `groupBy`: texto, 32; `zoom`: número, 25 a 200. |
| `audit` | `componentFilter`: texto, 120; `matrixFilter`: texto, 120; `selectedComponent`: texto, 120; `tab`: texto, 32; `severity`: texto, 16; `evidenceState`: texto, 32. |
| `artifacts` | `kindFilter`: texto, 32; `accessFilter`: texto, 16; `query`: texto, 200; `selectedKey`: texto, 200; `sortField`: texto, 32; `sortAsc`: booleano. |
| `routines` | `filter`: texto, 120; `selectedRoutine`: texto, 120; `approvalFilter`: texto, 32; `tab`: texto, 32. |
| `overview` | `query`: texto, 200; `sortField`: texto, 32; `sortAsc`: booleano; `page`: número, 100.000; `pageSize`: número, 100. |
| `office` | `hudHidden`: booleano; `mouseSensitivity`: número, 10; `scenePreferences`: objeto, 8.192 bytes; `viewMode`: objeto, 4.096 bytes; `windowLayout`: objeto, 16.384 bytes; `windowState`: objeto, 16.384 bytes; `workspaces`: objeto, 32.768 bytes. |
| `deploy` | `environment`: texto, 120; `pipeline`: texto, 120; `config`: objeto, 16.384 bytes; `history`: lista, 50; `selectedRun`: texto, 120; `tab`: texto, 32. |
| `diario` | `project`: texto, 120; `query`: texto, 200; `agentFilter`: texto, 32; `dateFrom`: texto, 10; `dateTo`: texto, 10; `sortField`: texto, 32; `sortAsc`: booleano; `page`: número, 100.000; `pageSize`: número, 100; `allClosed`: booleano. |

## Chaves antigas migradas

| Tela | `migraDe` |
|---|---|
| `chats` | `harness_chats_view_mode`, `harness_chats_page_size`, `harness_chat_draft_*`, `harness_groups_*`, `harness_chat_engine_settings` |
| `studio` | `harness_studio_sidebar_width`, `harness_studio_sidebar_width_*`, `harness_studio_source_open`, `harness_studio_source_width`, `harness_studio_active_view`, `harness_studio_active_view_*` |
| `prototypes` | `harness.atelier.inspector`, `harness_proto_workspace_layout`, `harness.canvas.v1*` |
| `office` | `dai_office_hud_hidden`, `dai_mouse_sensitivity`, `dai_office_scene_preferences`, `dai_office_view_mode:*`, `dai:wm:layout:*`, `dai:wm:state:*`, `dai:wm:workspaces:*` |
| `deploy` | `harness_deploy_config`, `harness_deploy_history` |
| `scrum`, `layers`, `board`, `audit`, `artifacts`, `routines`, `overview`, `diario` | Nenhuma chave antiga; o estado nasce no registro. |

## Exclusões justificadas

| Chave | Motivo |
|---|---|
| `harness_pin` | Credencial do acesso remoto; não é estado de tela e não deve ir para o servidor. |
| `harness_active_project` | Seleção de projeto anterior a qualquer tela; permanece como reserva offline compartilhada. |
| `harness_chat_open` | Sinal efêmero da mini conversa, apenas removido; não guarda estado a restaurar. |
| `hia_tokens_saved` | Contador local de telemetria HIA; não é estado de tela. |

O teste `tests/screen-registry.test.js` varre `ui/public/js/` e falha se alguma chave de
`localStorage` não estiver em `migraDe` nem nas exclusões.

## Como estender

1. Adicione a tela ou o campo em `registry.js` com tipo e limite.
2. Inclua a chave antiga em `migraDe` (ou justifique em `EXCLUSOES`).
3. Atualize este catálogo.
4. Rode `node --test tests/screen-registry.test.js`.

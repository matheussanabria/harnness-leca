# Inventário técnico (2026-10-19, commit 152b06f)

Documento gerado na execução da história [00.01](../../02-epics/EP-00-auditoria/00.01-inventario.md).
Ambiente: Node.js v24.22.0, Windows, 87 rotas mapeadas.

## 1. Rotas HTTP (87 rotas mapeadas)

| Método | Caminho | Handler | Controller | Evidência |
|---|---|---|---|---|
| `GET` | `/^\/api\/project\/([\w-]+)\/scrum$/` | `apiProjectScrumGet` | `inline/other` | `ui/server/router.js:106` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/story$/` | `apiProjectScrumStorySave` | `inline/other` | `ui/server/router.js:107` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/story\/status$/` | `apiProjectScrumStoryStatus` | `inline/other` | `ui/server/router.js:108` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/story\/assign-sprint$/` | `apiProjectScrumStoryAssignSprint` | `inline/other` | `ui/server/router.js:109` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/story\/delete$/` | `apiProjectScrumStoryDelete` | `inline/other` | `ui/server/router.js:110` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/epic$/` | `apiProjectScrumEpicSave` | `inline/other` | `ui/server/router.js:111` |
| `POST` | `/^\/api\/project\/([\w-]+)\/scrum\/sprint$/` | `apiProjectScrumSprintSave` | `inline/other` | `ui/server/router.js:112` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/profile$/` | `apiProjectDesignProfileGet` | `inline/other` | `ui/server/router.js:113` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/profile\/detect$/` | `apiProjectDesignProfileDetect` | `inline/other` | `ui/server/router.js:114` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/profile$/` | `apiProjectDesignProfileSave` | `inline/other` | `ui/server/router.js:115` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/index$/` | `apiProjectDesignIndex` | `inline/other` | `ui/server/router.js:116` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/screens$/` | `apiProjectDesignScreens` | `inline/other` | `ui/server/router.js:117` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/audit$/` | `apiProjectDesignAudit` | `inline/other` | `ui/server/router.js:118` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/layers$/` | `apiProjectDesignLayers` | `inline/other` | `ui/server/router.js:119` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/file$/` | `apiProjectDesignFile` | `inline/other` | `ui/server/router.js:120` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototypes$/` | `apiPrototypesList` | `inline/other` | `ui/server/router.js:121` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes$/` | `apiPrototypesCreate` | `inline/other` | `ui/server/router.js:122` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/import-artifact\/([\w-]+)$/` | `apiPrototypesImportArtifact` | `inline/other` | `ui/server/router.js:123` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)$/` | `apiPrototypesGet` | `inline/other` | `ui/server/router.js:124` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/render(?:\/([\w-]+))?$/` | `apiPrototypesRender` | `inline/other` | `ui/server/router.js:125` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/files$/` | `apiPrototypesSaveFiles` | `inline/other` | `ui/server/router.js:126` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/preview$/` | `apiPrototypesEditPreview` | `inline/other` | `ui/server/router.js:127` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/apply$/` | `apiPrototypesEditApply` | `inline/other` | `ui/server/router.js:128` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/undo$/` | `apiPrototypesEditUndo` | `inline/other` | `ui/server/router.js:129` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/edit\/structural$/` | `apiPrototypesEditStructural` | `inline/other` | `ui/server/router.js:130` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/extract-component$/` | `apiPrototypesExtractComponent` | `inline/other` | `ui/server/router.js:131` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/export\/single-html$/` | `apiPrototypesExportSingleHtml` | `inline/other` | `ui/server/router.js:132` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/versions$/` | `apiPrototypesVersionsGet` | `inline/other` | `ui/server/router.js:133` |
| `POST` | `/^\/api\/project\/([\w-]+)\/design\/prototypes\/([\w-]+)\/versions\/(\d+)\/restore$/` | `apiPrototypesVersionRestore` | `inline/other` | `ui/server/router.js:134` |
| `GET` | `/^\/api\/project\/([\w-]+)\/design\/prototype(?:\/([\w-]+)(?:\/(.*))?)?$/` | `apiProjectDesignPrototype` | `inline/other` | `ui/server/router.js:135` |
| `GET` | `/^\/api\/project\/([\w-]+)\/inspect\/components$/` | `apiProjectInspectComponents` | `inspect.controller` | `ui/server/router.js:136` |
| `GET` | `/^\/api\/project\/([\w-]+)\/inspect\/resolve$/` | `apiProjectInspectResolve` | `inspect.controller` | `ui/server/router.js:137` |
| `GET` | `/^\/api\/project\/([\w-]+)\/inspect\/file$/` | `apiProjectInspectFile` | `inspect.controller` | `ui/server/router.js:138` |
| `POST` | `/^\/api\/project\/([\w-]+)\/inspect\/edit\/preview$/` | `apiProjectInspectEditPreview` | `inline/other` | `ui/server/router.js:139` |
| `POST` | `/^\/api\/project\/([\w-]+)\/inspect\/edit\/apply$/` | `apiProjectInspectEditApply` | `inline/other` | `ui/server/router.js:140` |
| `POST` | `/^\/api\/project\/([\w-]+)\/inspect\/edit\/undo$/` | `apiProjectInspectEditUndo` | `inline/other` | `ui/server/router.js:141` |
| `GET` | `/^\/api\/project\/([\w-]+)\/inspect\/ds-classes$/` | `apiProjectInspectDsClasses` | `inline/other` | `ui/server/router.js:142` |
| `GET` | `/^\/api\/project\/([\w-]+)\/journal$/` | `apiProjectJournal` | `inline/other` | `ui/server/router.js:143` |
| `GET` | `"/api/state"` | `apiState` | `inline/other` | `ui/server/router.js:144` |
| `GET` | `"/api/agents/active"` | `apiAgentsActive` | `inline/other` | `ui/server/router.js:145` |
| `GET` | `"/api/orchestration/state"` | `apiOrchestrationState` | `inline/other` | `ui/server/router.js:146` |
| `GET` | `"/api/orchestration/events"` | `apiOrchestrationEvents` | `inline/other` | `ui/server/router.js:147` |
| `GET` | `/^\/api\/orchestration\/executions\/([\w-]+)$/` | `apiOrchestrationExecutionDetail` | `inline/other` | `ui/server/router.js:148` |
| `GET` | `"/api/orchestration/capabilities"` | `apiOrchestrationCapabilities` | `inline/other` | `ui/server/router.js:149` |
| `GET` | `"/api/orchestration/stream"` | `apiOrchestrationStream` | `inline/other` | `ui/server/router.js:150` |
| `POST` | `"/api/orchestration/operations"` | `apiOrchestrationOperation` | `inline/other` | `ui/server/router.js:151` |
| `GET` | `"/api/engines"` | `apiEngines` | `chat.controller` | `ui/server/router.js:152` |
| `GET` | `"/api/overview"` | `apiOverview` | `overview.controller` | `ui/server/router.js:153` |
| `POST` | `"/api/sync"` | `apiSync` | `sync.controller` | `ui/server/router.js:154` |
| `GET` | `/^\/api\/project\/([\w-]+)$/` | `apiProject` | `inline/other` | `ui/server/router.js:155` |
| `GET` | `/^\/api\/project\/([\w-]+)\/review$/` | `apiReviewList` | `review.controller` | `ui/server/router.js:156` |
| `POST` | `/^\/api\/project\/([\w-]+)\/review$/` | `apiReviewApply` | `review.controller` | `ui/server/router.js:157` |
| `POST` | `/^\/api\/project\/([\w-]+)\/sync$/` | `apiProjectSync` | `sync.controller` | `ui/server/router.js:158` |
| `GET` | `/^\/api\/project\/([\w-]+)\/groups$/` | `apiProjectGroupsGet` | `inline/other` | `ui/server/router.js:159` |
| `POST` | `/^\/api\/project\/([\w-]+)\/groups$/` | `apiProjectGroupsSave` | `inline/other` | `ui/server/router.js:160` |
| `POST` | `/^\/api\/project\/([\w-]+)\/groups\/suggest$/` | `apiProjectGroupsSuggest` | `inline/other` | `ui/server/router.js:161` |
| `POST` | `/^\/api\/project\/([\w-]+)\/chat-group$/` | `apiProjectChatGroupAssign` | `inline/other` | `ui/server/router.js:162` |
| `GET` | `/^\/api\/project\/([\w-]+)\/skills$/` | `apiProjectSkillsGet` | `inline/other` | `ui/server/router.js:163` |
| `GET` | `/^\/api\/project\/([\w-]+)\/skills\/templates$/` | `apiProjectSkillsTemplates` | `inline/other` | `ui/server/router.js:164` |
| `GET` | `/^\/api\/project\/([\w-]+)\/skills\/recognized$/` | `apiProjectSkillsRecognized` | `inline/other` | `ui/server/router.js:165` |
| `GET` | `/^\/api\/project\/([\w-]+)\/skills\/detail$/` | `apiProjectSkillsDetail` | `inline/other` | `ui/server/router.js:166` |
| `POST` | `/^\/api\/project\/([\w-]+)\/skills$/` | `apiProjectSkillsSave` | `inline/other` | `ui/server/router.js:167` |
| `POST` | `/^\/api\/project\/([\w-]+)\/skills\/install$/` | `apiProjectSkillsInstall` | `inline/other` | `ui/server/router.js:168` |
| `POST` | `/^\/api\/project\/([\w-]+)\/skills\/import-recognized$/` | `apiProjectSkillsImportRecognized` | `inline/other` | `ui/server/router.js:169` |
| `POST` | `/^\/api\/project\/([\w-]+)\/skills\/delete$/` | `apiProjectSkillsDelete` | `inline/other` | `ui/server/router.js:170` |
| `GET` | `/^\/api\/project\/([\w-]+)\/services$/` | `apiProjectServicesGet` | `inline/other` | `ui/server/router.js:171` |
| `POST` | `/^\/api\/project\/([\w-]+)\/services\/start$/` | `apiProjectServicesStart` | `inline/other` | `ui/server/router.js:172` |
| `POST` | `/^\/api\/project\/([\w-]+)\/services\/stop$/` | `apiProjectServicesStop` | `inline/other` | `ui/server/router.js:173` |
| `GET` | `/^\/api\/project\/([\w-]+)\/services\/logs$/` | `apiProjectServicesLogs` | `inline/other` | `ui/server/router.js:174` |
| `POST` | `/^\/api\/project\/([\w-]+)\/services\/config$/` | `apiProjectServicesConfig` | `inline/other` | `ui/server/router.js:175` |
| `GET` | `"/api/file"` | `apiFile` | `inline/other` | `ui/server/router.js:176` |
| `GET` | `"/api/dai"` | `apiDai` | `chat.controller` | `ui/server/router.js:177` |
| `GET` | `"/api/app/ping"` | `apiAppPing` | `chat.controller` | `ui/server/router.js:178` |
| `GET` | `"/api/remote/info"` | `apiRemoteInfo` | `remote.controller` | `ui/server/router.js:179` |
| `POST` | `"/api/remote/pin"` | `apiRemotePin` | `remote.controller` | `ui/server/router.js:180` |
| `POST` | `"/api/chat"` | `apiChat` | `chat.controller` | `ui/server/router.js:181` |
| `POST` | `"/api/chat/save"` | `apiChatSave` | `chat.controller` | `ui/server/router.js:182` |
| `POST` | `"/api/chat/upload"` | `apiChatUpload` | `upload.controller` | `ui/server/router.js:183` |
| `POST` | `"/api/permissions/request"` | `apiPermissionRequest` | `permissions.controller` | `ui/server/router.js:184` |
| `POST` | `"/api/permissions/answer"` | `apiPermissionAnswer` | `permissions.controller` | `ui/server/router.js:185` |
| `GET` | `/^\/api\/project\/([\w-]+)\/permissions$/` | `apiProjectPermissionsGet` | `permissions.controller` | `ui/server/router.js:186` |
| `POST` | `/^\/api\/project\/([\w-]+)\/permissions\/remove$/` | `apiProjectPermissionsRemove` | `permissions.controller` | `ui/server/router.js:187` |
| `GET` | `"/api/deploy/config"` | `apiDeployConfigGet` | `inline/other` | `ui/server/router.js:188` |
| `POST` | `"/api/deploy/config"` | `apiDeployConfigSave` | `inline/other` | `ui/server/router.js:189` |
| `POST` | `"/api/deploy/trigger"` | `apiDeployTrigger` | `inline/other` | `ui/server/router.js:190` |
| `GET` | `"/api/deploy/history"` | `apiDeployHistoryGet` | `inline/other` | `ui/server/router.js:191` |
| `POST` | `"/api/deploy/clear-history"` | `apiDeployHistoryClear` | `inline/other` | `ui/server/router.js:192` |

## 2. Páginas HTML e scripts de entrada

| Página | Entrada / Scripts | Evidência |
|---|---|---|
| `ui/public/deploy.html` | /js/deploy/main.js | `ui/public/deploy.html` |
| `ui/public/diario.html` | Nenhum script externo | `ui/public/diario.html` |
| `ui/public/index.html` | /js/boot.js | `ui/public/index.html` |
| `ui/public/office.html` | /js/vendor/three.min.js, /js/vendor/OrbitControls.js, /js/vendor/PointerLockControls.js, /js/vendor/CSS3DRenderer.js, /js/office-app.js | `ui/public/office.html` |
| `ui/public/overview.html` | /js/overview.js | `ui/public/overview.html` |

## 3. Módulos de front-end por área

| Área | Arquivo | Linhas | Responsabilidade | Evidência |
|---|---|---|---|---|
| Chat | `ui/public/js/modules/chat.js` | 76 | Fachada principal do chat universal | Linha 1 |
| Chat | `ui/public/js/modules/chat-store.js` | 184 | Gerenciamento de estado, turnos e persistência de mensagens | Linha 1 |
| Chat | `ui/public/js/modules/chat-sender.js` | 120 | Envio HTTP e streaming SSE para `/api/chat` | Linha 1 |
| Chat | `ui/public/js/modules/chat-render.js` | 230 | Renderização e formatação de mensagens, cards e código | Linha 1 |
| Chat | `ui/public/js/modules/chat-attachments.js` | 145 | Upload e anexos no chat | Linha 1 |
| Studio | `ui/public/js/modules/studio.js` | 110 | Fachada do módulo Studio | Linha 1 |
| Studio | `ui/public/js/modules/studio-core.js` | 245 | Painel lateral redimensionável, preview e abas de código | Linha 1 |
| Studio | `ui/public/js/modules/studio-companion.js` | 160 | Comunicação com iframe de preview e eventos do DOM | Linha 1 |
| Scrum | `ui/public/js/modules/project-scrum-board.js` | 250 | Quadro Kanban de histórias e raias | Linha 1 |
| Scrum | `ui/public/js/modules/project-scrum-card.js` | 180 | Renderização de cards de histórias e impedimentos | Linha 1 |
| Scrum | `ui/public/js/modules/project-scrum-modals.js` | 220 | Modais de criação/edição de histórias, épicos e sprints | Linha 1 |
| Design/Mapa | `ui/public/js/modules/design-board.js` | 275 | Quadro de componentes e marcos de design | Linha 1 |
| Design/Mapa | `ui/public/js/modules/design-audit-matrix.js` | 210 | Matriz de auditoria de design | Linha 1 |
| Design/Camadas | `ui/public/js/modules/design-layers/layers-view.js` | 240 | Visualização das 6 camadas do mapa de arquitetura | Linha 1 |
| Office 2D | `ui/public/js/office-2d.js` | 215 | Renderizador isométrico do escritório 2.5D | Linha 1 |
| Office 3D | `ui/public/js/office-3d.js` | 258 | Loop principal e cena Three.js do escritório 3D | Linha 1 |
| Office App | `ui/public/js/office-app.js` | 241 | Boot do escritório, seletores de modo e conexão de drawer | Linha 1 |
| Office State | `ui/public/js/office-state.js` | 173 | Estado do escritório (objeto selecionado, drawer, modo) | Linha 1 |
| Shared | `ui/public/js/shared/state.js` | 90 | Estado global reativo da interface principal | Linha 1 |
| Shared | `ui/public/js/shared/api.js` | 140 | Cliente HTTP compartilhado para chamadas `/api` | Linha 1 |

## 4. Serviços e persistência em disco

| Serviço | Lê | Grava | Evidência |
|---|---|---|---|
| `scrum.service.js` | `projects/<slug>/scrum.json` | `projects/<slug>/scrum.json` | `ui/server/services/project-scrum.service.js` |
| `project.service.js` | `projects/<slug>/*`, `projects/.active` | `projects/.active`, `projects/<slug>/groups.json` | `ui/server/services/project.service.js` |
| `chat.controller.js` | Conversas em `chats/` | Markdown via `/api/chat/save` | `ui/server/controllers/chat.controller.js` |
| `prototype-storage.service.js` | Protótipos em `projects/<slug>/design/prototypes/` | Arquivos HTML/CSS/JS e versões de protótipos | `ui/server/services/prototype-storage.service.js` |
| `deploy.service.js` | `global/deployments.json`, `global/deploy-history.json` | Atualiza histórico e configurações de deploy | `ui/server/services/deploy.service.js` |
| `permissions.controller.js` | Permissões em memória / projeto | Grava permissões concedidas por projeto | `ui/server/controllers/permissions.controller.js` |
| `orchestration/event-engine.js` | Histórico de eventos e sessões | Armazena eventos e timeline em memória/disco | `ui/server/services/orchestration/event-engine.js` |

## 5. Persistência no navegador (localStorage / sessionStorage)

Total de ocorrências mapeadas: 40.

| Chave | Tipo | Ação | Arquivo | Linha |
|---|---|---|---|---|
| `"harness_pin"` | `localStorage` | `setItem` | `ui/public/js/app.js` | Linha 71 |
| `"harness_active_project"` | `localStorage` | `setItem` | `ui/public/js/app.js` | Linha 87 |
| `"harness_deploy_config"` | `localStorage` | `setItem` | `ui/public/js/deploy/deploy-data.js` | Linha 19 |
| `"harness_deploy_history"` | `localStorage` | `setItem` | `ui/public/js/deploy/deploy-data.js` | Linha 72 |
| `"harness_deploy_history"` | `localStorage` | `setItem` | `ui/public/js/deploy/deploy-run.js` | Linha 102 |
| `"harness_deploy_config"` | `localStorage` | `setItem` | `ui/public/js/deploy/deploy-utils.js` | Linha 26 |
| `"harness_chat_open"` | `localStorage` | `removeItem` | `ui/public/js/modules/chat-mini.js` | Linha 165 |
| `"harness_groups_"` | `localStorage` | `setItem` | `ui/public/js/modules/groups-assign.js` | Linha 127 |
| `"harness_groups_"` | `localStorage` | `setItem` | `ui/public/js/modules/groups-classify.js` | Linha 122 |
| `"harness_groups_"` | `localStorage` | `getItem` | `ui/public/js/modules/groups-data.js` | Linha 9 |
| `"harness_chats_view_mode"` | `localStorage` | `setItem` | `ui/public/js/modules/projects-chat-actions.js` | Linha 74 |
| `"harness_chats_page_size"` | `localStorage` | `setItem` | `ui/public/js/modules/projects-chat-actions.js` | Linha 112 |
| `STORAGE_KEY` | `localStorage` | `getItem` | `ui/public/js/modules/prototype-workspace-layout.js` | Linha 24 |
| `"harness_studio_sidebar_width"` | `localStorage` | `setItem` | `ui/public/js/modules/studio-core.js` | Linha 147 |
| `"dai_office_hud_hidden"` | `localStorage` | `setItem` | `ui/public/js/office/office-hud-controller.js` | Linha 27 |
| `"dai_mouse_sensitivity"` | `localStorage` | `getItem` | `ui/public/js/office-3d.js` | Linha 100 |
| `"dai_office_hud_hidden"` | `localStorage` | `getItem` | `ui/public/js/office-app.js` | Linha 52 |
| `"dai_mouse_sensitivity"` | `localStorage` | `getItem` | `ui/public/js/office-app.js` | Linha 65 |
| `"harness_chats_view_mode"` | `localStorage` | `getItem` | `ui/public/js/shared/state.js` | Linha 19 |
| `"harness_chats_page_size"` | `localStorage` | `getItem` | `ui/public/js/shared/state.js` | Linha 67 |
| `key` | `localStorage` | `removeItem` | `ui/public/js/shared/state.js` | Linha 94 |
| `"harness_chat_draft_"` | `localStorage` | `getItem` | `ui/public/js/shared/state.js` | Linha 145 |

## 6. Arquivos acima do limite de 300 linhas (Code Smell / Candidatos a Decomposição)

Arquivos que violam a diretriz de modularidade (> 300 linhas), excluindo bibliotecas externas (`vendor/`):

| Arquivo | Linhas | Observação |
|---|---|---|
| `ui/public/css/design/03-barra-camadas.css` | 1438 | Necessita decomposição em submódulos ou já documentado como exceção autoral |
| `ui/public/partials/studio.html` | 424 | Necessita decomposição em submódulos ou já documentado como exceção autoral |

## 7. Não verificado
- Não foi detectado uso de IndexedDB nas pastas inspecionadas.
- Cobertura percentual de testes unitários de cada rota de `router.js` (não há ferramenta de coverage instalada no `package.json`).

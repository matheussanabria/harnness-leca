---
domain: frontend
module: coverage
feature: design-layers-ui
summary: Layer Map UI state, audience, navigation, screen replicas and layer detail renderers.
paths: [ui/public/js/modules/design-layers-api-data.js, ui/public/js/modules/design-layers-core.js, ui/public/js/modules/design-layers-store.js, ui/public/js/modules/design-layers-tests-legacy.js, ui/public/js/modules/design-layers-ui-rules.js, ui/public/js/modules/design-layers-workspace.js, ui/public/js/modules/design-layers/layers-audience-profiles.js, ui/public/js/modules/design-layers/layers-audience.js, ui/public/js/modules/design-layers/layers-detail-api-data.js, ui/public/js/modules/design-layers/layers-detail-tests-legacy.js, ui/public/js/modules/design-layers/layers-detail-ui-rules.js, ui/public/js/modules/design-layers/layers-header.js, ui/public/js/modules/design-layers/layers-right-content.js, ui/public/js/modules/design-layers/layers-screen-replica-s2.js, ui/public/js/modules/design-layers/layers-screen-replica-s3.js, ui/public/js/modules/design-layers/layers-screen-replica-s4.js, ui/public/js/modules/design-layers/layers-screen-replica.js, ui/public/js/modules/design-layers/layers-stages-nav.js, ui/public/js/modules/design-layers/layers-state.js, ui/public/js/modules/design-layers/layers-tabs-nav.js]
keywords: [design, layers, layer-map, screen-replica, workspace]
updated: 2026-11-16
---
# Layer Map UI / Interface do Mapa em Camadas

| File | Responsibility |
|---|---|
| `ui/public/js/modules/design-layers-api-data.js` | Renders API/services and data/entity layer details. / Renderiza detalhes das camadas de API/serviços e dados/entidades. |
| `ui/public/js/modules/design-layers-core.js` | Defines layer configuration and current screen/focus state. / Define configuração das camadas e estado de tela/foco atual. |
| `ui/public/js/modules/design-layers-store.js` | Holds shared mutable Layer Map state. / Mantém o estado mutável compartilhado do Mapa em Camadas. |
| `ui/public/js/modules/design-layers-tests-legacy.js` | Renders test and legacy layer details and dispatches the active layer. / Renderiza detalhes de testes e legado e despacha a camada ativa. |
| `ui/public/js/modules/design-layers-ui-rules.js` | Renders UI/UX and business rule layers and field filters. / Renderiza as camadas de UI/UX e regras de negócio e filtros de campos. |
| `ui/public/js/modules/design-layers-workspace.js` | Builds the two-column Layer Map workspace. / Monta o espaço de trabalho do Mapa em Camadas em duas colunas. |
| `ui/public/js/modules/design-layers/layers-audience-profiles.js` | Defines audience profiles and their visible layer sets. / Define perfis de público e seus conjuntos de camadas visíveis. |
| `ui/public/js/modules/design-layers/layers-audience.js` | Renders the audience selector. / Renderiza o seletor de público. |
| `ui/public/js/modules/design-layers/layers-detail-api-data.js` | Renders the detailed API/services layer. / Renderiza a camada detalhada de API e serviços. |
| `ui/public/js/modules/design-layers/layers-detail-tests-legacy.js` | Renders detailed test/BDD and legacy layers. / Renderiza as camadas detalhadas de testes/BDD e legado. |
| `ui/public/js/modules/design-layers/layers-detail-ui-rules.js` | Filters references by focus and renders UI/rule details. / Filtra referências por foco e renderiza detalhes de UI/regras. |
| `ui/public/js/modules/design-layers/layers-header.js` | Renders the complete Layer Map screen header. / Renderiza o cabeçalho completo da tela do Mapa em Camadas. |
| `ui/public/js/modules/design-layers/layers-right-content.js` | Renders the Layer Map right content column. / Renderiza a coluna direita de conteúdo do Mapa em Camadas. |
| `ui/public/js/modules/design-layers/layers-screen-replica-s2.js` | Renders numbered screen-replica markers for screen state 2. / Renderiza marcadores numerados da réplica para o estado de tela 2. |
| `ui/public/js/modules/design-layers/layers-screen-replica-s3.js` | Renders numbered screen-replica markers for screen state 3. / Renderiza marcadores numerados da réplica para o estado de tela 3. |
| `ui/public/js/modules/design-layers/layers-screen-replica-s4.js` | Renders numbered screen-replica markers for screen state 4. / Renderiza marcadores numerados da réplica para o estado de tela 4. |
| `ui/public/js/modules/design-layers/layers-screen-replica.js` | Renders screen replicas and their numbered field markers. / Renderiza réplicas de tela e marcadores numerados dos campos. |
| `ui/public/js/modules/design-layers/layers-stages-nav.js` | Renders navigation across business flow stages. / Renderiza navegação pelas etapas do fluxo de negócio. |
| `ui/public/js/modules/design-layers/layers-state.js` | Defines semantic layer status labels and legacy classifications. / Define rótulos semânticos de status e classificações de legado. |
| `ui/public/js/modules/design-layers/layers-tabs-nav.js` | Renders the six layer tabs and active-tab styling. / Renderiza as seis abas de camadas e o destaque da aba ativa. |

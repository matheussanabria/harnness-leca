---
domain: design
module: system
feature: project-ds-hl
summary: Local hl.* design-system artifacts and prototype; tracked registry and catalog consumers.
paths: [ui/server/services/design-registry.service.js, ui/public/js/modules/prototype-catalog.js]
keywords: [hl, design-system, componentes, boilerplate, navegacao-de-projetos, seletor, projetos, ateliê, prototipo]
updated: 2026-11-16
---
# DS hl.* do harness-leca

Local-only inventory / Inventario local: project artifacts below are not shipped in a clone. The paths field indexes the tracked consumers, following prototype-catalog.md.

Os artefatos de projeto abaixo nao acompanham o clone. O campo paths aponta aos consumidores versionados, conforme prototype-catalog.md.

Componentes do Harness reutilizáveis nos protótipos do Ateliê. Cada pasta tem `manifest.json`, o boilerplate `<slug>.html` (já com `data-component="hl.<slug>"`), `<slug>.css` e, quando há comportamento, `<slug>.js`. Prefixo de classe `hl-`.

| File | Responsibility |
|---|---|
| `projects/harness-leca/design/ds/registry.json` | Registry do projeto (namespace `hl`, 17 componentes); sobrepõe o global por id. |
| `projects/harness-leca/design/ds/hl-tokens.css` | Variáveis (espelham `ui/public/css/base.css`), utilitários `hl-mono`, `hl-mute`, `hl-scrim` e foco visível. |
| `projects/harness-leca/design/ds/hl-components.css` | CSS agregado de todos os componentes, para incluir de uma vez. |
| `projects/harness-leca/design/ds/components/mask-icon/` | `hl.mask-icon` (html, css, manifest): Ícone por máscara. |
| `projects/harness-leca/design/ds/components/action-button/` | `hl.action-button` (html, css, manifest): Botão de ação. |
| `projects/harness-leca/design/ds/components/status-pill/` | `hl.status-pill` (html, css, manifest): Pílula de status. |
| `projects/harness-leca/design/ds/components/category-pill/` | `hl.category-pill` (html, css, manifest): Pílula de categoria. |
| `projects/harness-leca/design/ds/components/filter-chip/` | `hl.filter-chip` (html, css, js, manifest): Chip de filtro. |
| `projects/harness-leca/design/ds/components/search-field/` | `hl.search-field` (html, css, manifest): Campo de busca. |
| `projects/harness-leca/design/ds/components/view-toggle/` | `hl.view-toggle` (html, css, manifest): Alternador de visão. |
| `projects/harness-leca/design/ds/components/list-toolbar/` | `hl.list-toolbar` (html, css, manifest): Barra da lista. |
| `projects/harness-leca/design/ds/components/app-header/` | `hl.app-header` (html, css, js, manifest): Cabeçalho do app. |
| `projects/harness-leca/design/ds/components/page-shell/` | `hl.page-shell` (html, css, manifest): Casco de página. |
| `projects/harness-leca/design/ds/components/filter-panel/` | `hl.filter-panel` (html, css, manifest): Painel de filtros. |
| `projects/harness-leca/design/ds/components/project-table/` | `hl.project-table` (html, css, manifest): Tabela de projetos. |
| `projects/harness-leca/design/ds/components/project-card/` | `hl.project-card` (html, css, manifest): Cartão de projeto. |
| `projects/harness-leca/design/ds/components/project-picker/` | `hl.project-picker` (html, css, js, manifest): Seletor de projeto. |
| `projects/harness-leca/design/ds/components/classify-dialog/` | `hl.classify-dialog` (html, css, js, manifest): Diálogo de classificação. |
| `projects/harness-leca/design/ds/components/state-panel/` | `hl.state-panel` (html, css, manifest): Painel de estado. |
| `projects/harness-leca/design/ds/components/bottom-sheet/` | `hl.bottom-sheet` (html, css, js, manifest): Gaveta inferior. |
| `projects/harness-leca/design/prototypes/navegacao-de-projetos/` | Protótipo (8 telas: tabela, filtros, cards, seletor, busca, classificar, estados, mobile); CSS dos componentes embutido entre `@ds begin` e `@ds end` em `styles/proto.css`. |

- Reuso: copie o boilerplate, inclua os dois CSS, navegue com `data-action="goto:<tela>"`. O `MAPA.md` do protótipo traz o passo a passo.
- Os dados dos projetos nas telas são ilustrativos; a classificação por categoria ainda não existe no harness.
- `projects/<slug>/design/` não é versionado neste repositório (ver `prototype-catalog.md`).

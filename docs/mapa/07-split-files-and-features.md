## 7. Arquivos divididos por tamanho (fachada + módulos)

Arquivos que passavam de 300 linhas viraram uma fachada fina (mesmos nomes exportados) mais módulos especializados. Procure o código nos módulos, não na fachada.

| Fachada | Módulos |
|---|---|
| `tools/lib/skills.js` | `tools/lib/skills/` (`frontmatter`, `targets`, `reader`, `writer`, `templates`, `recognized`, `catalog-web`, `catalog-api`) |
| `tools/lib/proc-manager.js`, `network.js`, `qrcode.js` | `proc-manager-*.js`, `network-*.js`, `qrcode-*.js` na mesma pasta (`*-store.js` guarda o estado compartilhado) |
| `tools/import-gemini-chats.js` | `tools/lib/gemini-import/` (`text`, `sessions`) |
| `ui/server/services/dc-artifact-adapter.service.js` | `dc-runtime-config.service.js` (constantes e verificação do runtime), `dc-artifact-parser.service.js` (leitura e validação), `dc-inspection-writer.service.js` (gravação das partes) |
| `ui/server/services/prototype-sandbox-renderer.service.js` | `prototype-sandbox-common.service.js` (estilos, ponte, CSP) e `prototype-sandbox-dc.service.js` (ramo DC) |
| `ui/server/services/project-scrum.service.js`, `project-screens.service.js`, `component-resolver.service.js`, `template-locator.service.js` | `project-scrum-*`, `project-screens-*`, `component-resolver-*`, `template-locator-*` na mesma pasta |
| Fontes e reconciliação do Scrum | `project-scrum-jira-source.js` lê o snapshot (comentários e sprints); `project-scrum-jira-sprints.js` extrai sprints do payload (Server/Cloud); `tools/export-jira-snapshot.js` (CLI) e `tools/lib/jira-export.js` (núcleo) geram o snapshot via REST v2 com `JIRA_BASE_URL`/`JIRA_PAT`; `scrum-jira-sync.controller.js` expõe `POST /scrum/jira-sync` e `design-scrum-jira-sync.js` traz o botão Sincronizar Jira; `project-scrum-doc-source.js` interpreta histórias; `project-scrum-resolver.js` compõe com o estado local |
| Consulta local ao snapshot do Jira | `tools/jira-query.js` (CLI: `issue`, `sprint`, `search`, `status`, `summary`) consulta o snapshot e o quadro local sem rede e sem token; `tools/jira-refresh.js` sincroniza o snapshot e regenera o panorama; `tools/lib/jira-snapshot.js` (leitura, busca e sprints), `tools/lib/jira-redact.js` (redige CPF/CNS/e-mail/telefone) e `tools/lib/jira-summary.js` (panorama para `context/jira-resumo.md`); testes em `tests/jira-query.test.js` |
| Configuração e ordem de raias Scrum | `project-scrum-lanes.js` valida catálogo/permutação; `design-scrum-lane-config.js` configura atributos; `design-scrum-lane-order-model.js` calcula a ordem visível; `design-scrum-lane-order.js` controla rede/drag/teclado; estilos em `css/design/10-scrum-lanes.css` e `11-scrum-lane-order.css` |
| Movimentação de histórias Scrum | `project-scrum-transitions.js` contém as regras; `design-scrum-story-transition.js` integra endpoint, drag, botões, anúncio e foco; histórico no drawer e estilos em `css/design/12-scrum-story-transitions.css` |
| Filtros e métricas Scrum | `design-scrum-filters.js` (seleção pura), `design-scrum-filter-bar.js` (barra compartilhada) e `design-scrum-metrics.js` (cálculo e strip); estilos em `css/design/13-scrum-filters-metrics.css` (EP-05.05) |
| `ui/server/services/orchestration/event-engine.js` | `event-engine-projection.js` (mixin com a projeção de eventos) |
| `ui/public/js/modules/design-layers.js` | `ui/public/js/modules/design-layers/` (`layers-header`, `layers-stages-nav`, `layers-tabs-nav`, `layers-screen-replica`, `layers-screen-replica-s2`, `layers-screen-replica-s3`, `layers-screen-replica-s4`, `layers-right-content`, `layers-detail-ui-rules`, `layers-detail-api-data`, `layers-detail-tests-legacy`, `layers-state`) |
| `ui/public/js/modules/chat.js`, `inspector.js`, `design-scrum.js`, `design-audit.js`, `groups.js`, `projects.js`, `skills.js`, `studio.js` | módulos `<nome>-*.js` na mesma pasta; `<nome>-store.js` guarda o estado mutável compartilhado |
| Detalhes de história Scrum | `design-scrum-story-card.js`, `design-scrum-story-drawer.js` e `design-scrum-status-mapping.js`; estilos em `css/design/09-scrum-story-details.css` |
| `ui/public/js/deploy/` | `main.js` (entrada), `deploy-*.js` (incluindo `deploy-state.js`), `deploy-store.js`; configuração no estado da tela e histórico somente em `/api/deploy/history` (EP-14.10) |
| `ui/public/js/office-3d.js`, `office-screen.js`, `office3d/world-*.js` | mixins `office-3d-controls`, `office-screen-*`, `office3d/war-room-*`, `office3d/workspace-*` |
| `ui/public/index.html` | blocos em `ui/public/partials/`, carregados por `ui/public/js/boot.js` antes do `app.js` |
| `ui/public/overview.html` | `css/overview.css` e `js/overview.js` |
| `ui/public/css/*.css` grandes | agregador `css/<nome>.css` importa `css/<nome>/NN-*.css` em ordem |
| `SETUP.md` | `docs/setup/` (importadores, rotinas e sync, interface e desenvolvimento) |
| Getting started (English) | `docs/setup/01-overview.md` (what the harness does), `02-installation.md` (clone, `.env`, hook), `03-engines-and-credentials.md` (install, login and credential location per engine), `04-first-sync.md` (first import, sync, export), `05-adopt-existing-projects.md` (adoption guide) |
| Agent guides (English) | `docs/agents/BOOTSTRAP.md` (phased setup and first sync with checks and stop rules) and `docs/agents/ADOPTION.md` (adoption procedure for agents) |
| Adopt an existing project | `tools/adopt-project.js` (CLI, `npm run adopt`), `tools/lib/adopt/detect-stack.js` (read-only stack detection from manifests) and `tools/lib/adopt/render.js` (seed `instructions.md` and `memory.md`); tests in `tests/adopt-project.test.js` |
| Mapa dividido por área | `MAPA.md` (porta de entrada e índice), `docs/mapa/*.md` (detalhe por área, cada um abaixo de ~20 KB), `scripts/lib/read-mapa.js` (lê o mapa inteiro para o pre-commit e os testes) e `getMapSection` em `tools/lib/hia/context-engine.js` (fatia seções, reunindo as partes de uma seção dividida) |

> Regra: arquivo novo exige o `MAPA.md` atualizado. O pre-commit (`scripts/pre-commit.js`, função `missingFromMapa`) barra o commit quando entra arquivo novo sem o mapa ser alterado no mesmo commit e sem que o caminho, o nome ou a pasta do arquivo apareçam aqui.

---

### Catálogo local de protótipos por projeto

| Caminho | Responsabilidade |
|---|---|
| `projects/<slug>/design/design.json` | Fonte explícita dos artefatos HTML exibidos na tela de protótipos daquele projeto. |
| `projects/<slug>/design/prototypes/<id>/` | Protótipos modulares e editáveis do Ateliê (`proto.json`, `screens/`, `styles/`, `data/`). |
| `projects/<slug>/design/05-dev-notas.md` | Registro de implementação, decisões estruturais e validações da evolução do catálogo. |

### Recriação do Design System a partir do HTML publicado

O `dis-design-system.html` carrega `window.DOCS` (código-fonte de cada componente, tokens e modelos de tela). O gerador converte isso em artefatos editáveis do Ateliê.

| Caminho | Responsabilidade |
|---|---|
| `tools/import-ds-docs.js` | CLI (`--source --project --root --out --assets --site --force --force-protos --dry-run`): escreve `ds/tokens.css`, `ds/components.css`, componentes no registry e os dois protótipos. |
| `tools/ds-docs/extract.js` | Lê `window.DOCS` do HTML (JSON com fim por chaves, respeitando strings) e lista os modelos de tela. |
| `tools/ds-docs/components.js` | Um componente do registry por item do DS (html, css, props, categoria, tokens usados). |
| `tools/ds-docs/screen-transform.js` | Transforma HTML de tela: `data-pid`, `data-component`, navegação `goto:`, imagens em data URI, scripts isolados. |
| `tools/ds-docs/patient-flow.js` | Protótipo `dis-paciente`: 8 telas navegáveis, `head.html` (ponte `harnessGoto`, sessionStorage em memória) e `proto.css`. |
| `tools/ds-docs/capture-site.js` | Captura (Playwright) o site do DS renderizado: topo, menu, CSS e cada página com as abas de código expandidas. Gera `tools/ds-docs/data/dis-design-system.site.json`. |
| `tools/ds-docs/docs-site.js` | Protótipo `dis-ds-vitrine` como site navegável: topo, menu lateral com `goto:`, uma tela por página e abas de código (usa a captura). |
| `tools/ds-docs/docs-live.js` | Cabeçalho e script que hidratam as demos da vitrine com o bundle React do DS (cdnjs) no modo play e restauram o HTML estático no inspetor. |
| `tools/ds-docs/search-screen.js` | Tela "Pesquisar paciente" do fluxo modular: formulário, abas esperados/atraso, tabelas com "Ver mais", filtro e clique no paciente levando à Visão geral. |
| `tools/ds-docs/showcase.js` | Vitrine simples (sem captura) e `snippetsFor`, que gera os blocos de código do canvas. |
| `tools/ds-docs/writer.js` | Grava arquivos, converte imagens em data URI e atualiza `design/design.json`. |
| `projects/<slug>/design/ds/components.css` | CSS agregado dos componentes; o renderer o injeta apenas em protótipos com `metadata.dsComponents: true`. |
| `projects/<slug>/design/prototypes/dis-paciente/` | Fluxo do paciente editável (visão geral, nova prescrição, medicamentos, entregas, sucesso, histórico, programas, anotações). |
| `projects/<slug>/design/prototypes/dis-ds-vitrine/` | Vitrine do DS: cada componente em sua própria tela, para usar no canvas. |

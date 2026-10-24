## 🎨 3. Onde Encontrar Cada Coisa (Frontend `ui/public/`) (part 3/3)

### Módulos JavaScript (`ui/public/js/`) (continued)

| Módulo | Arquivo Responsável | Responsabilidades |
|---|---|---|
| **Exclusão de protótipo (serviço)** | `ui/server/services/prototype-delete.service.js` | `deletePrototype`: move a pasta do Ateliê para `design/prototypes/.trash/<id>-<timestamp>` (recuperável; o catálogo ignora pastas com ponto) e remove a entrada do `design/design.json`. Entrada de artefato sai só do índice; o HTML não é tocado. |
| **Teste: exclusão de protótipo** | `tests/prototype-delete.test.js` | Cobre lixeira recuperável, remoção no design.json preservando o resto, artefato só por entrada, pasta sem entrada e ids inválidos. |
| **Regras da exclusão (cliente)** | `ui/public/js/modules/prototype-delete-model.js` | Texto da confirmação, próximo item a abrir depois de excluir e URL da rota; sem DOM. |
| **Diálogo de exclusão** | `ui/public/js/modules/prototype-delete-dialog.js` | Modal de confirmação próprio (Esc/Cancelar/Excluir), chama `POST .../prototypes/:id/delete` e avisa `harness:design-index-changed`. |
| **Teste: regras da exclusão** | `tests/prototype-delete-model.test.js` | Cobre texto, escolha do próximo item e URL. |
| **Teste: script de desenvolvimento** | `tests/dev-script.test.js` | Garante que `npm run ui:dev` e `ui:dev:remote` usam `node --watch` (sem dependência) e só observa pastas do servidor que existem. |
| **Teste: realce de sintaxe** | `tests/prototype-code-highlight.test.js` | Cobre cores e escape do realce. |
| **Painel: aba de código (modelo)** | `ui/public/js/modules/prototype-props-code-model.js` | Regras puras: abas, texto de cada aba e linhas de componente/arquivos. |
| **Teste: aba de código** | `tests/prototype-props-code.test.js` | Cobre `pickCode` e `fileLines`. |
| **Teste: Tipografia** | `tests/prototype-props-type.test.js` | Cobre o modelo de tipografia. |
| **API de Edição Direta** | `ui/public/js/modules/prototype-edit-api.js` | Chamada em fila ao `edit/apply` (setStyles e moveTo) usada pelo painel, pelo arrastar no canvas e pela árvore de camadas. |
| **Arrastar Camadas** | `ui/public/js/modules/prototype-layer-drag.js` | Arrastar e soltar na árvore de camadas: reordena antes, depois ou dentro da camada de destino. |
| **Ponte: medidas e arrastar** | `ui/public/js/modules/prototype-bridge-props.js`, `prototype-bridge-drag.js` | Scripts do iframe: lê medidas e a regra `px-*` do elemento, aplica prévia de estilos e arrasta elementos no canvas com linha de encaixe (`HARNESS_PROTO_REORDER`). |
| **Ponte: seleção múltipla e atalhos** | `ui/public/js/modules/prototype-bridge-multi.js` | Script do iframe (usa `window.__harnessBridge`): contorno da seleção múltipla, clique com Shift/Ctrl, Esc e atalhos Ctrl+Z/Y/G, Delete e Ctrl+D enviados à janela-mãe. Separado do `prototype-bridge.js` para respeitar o limite de 250 linhas. |
| **Estilos do Painel (servidor)** | `ui/server/services/prototype-style.service.js` | Valida propriedades permitidas, cria a classe `px-<pid>`, grava a regra no `proto.css` e remove o estilo inline conflitante. |
| **Reordenar Elementos (servidor)** | `ui/server/services/prototype-reorder.service.js` | Move um nó por `data-pid` para antes, depois ou dentro de outro, sem permitir mover para dentro de si mesmo. |
| **CSS do Painel** | `ui/public/css/design/15-prototype-props.css` | Estilos do painel Posição e Layout. |
| **Testes Posição e Layout** | `tests/prototype-style.test.js`, `tests/prototype-props-model.test.js`, `tests/prototype-bridge-scripts.test.js` | Estilos, reordenação com desfazer, regras do painel e ordem/limites dos scripts da ponte. |
| **Canvas: Modelo** | `ui/public/js/modules/prototype-canvas/canvas-model.js` | Funções puras: documento, câmera (zoom no cursor, fit), itens, hit-test, ordem de navegação e validação do documento salvo. |
| **Canvas: Persistência** | `ui/public/js/modules/prototype-canvas/canvas-store.js` | Leitura/gravação do documento do canvas no `localStorage` por projeto e protótipo, com salvamento adiado. |
| **Canvas: Motor** | `ui/public/js/modules/prototype-canvas/canvas-engine.js` | Estado do canvas (documento, seleção, ferramenta, câmera) e DOM do mundo com os itens. |
| **Canvas: Itens** | `ui/public/js/modules/prototype-canvas/canvas-items-view.js` | Cria o DOM de quadros (iframes escalados com escudo), textos, notas e retângulos. |
| **Canvas: Blocos de código** | `ui/public/js/modules/prototype-canvas/canvas-code-block.js` | Bloco de código (editor, linguagem, preview HTML em sandbox, copiar e baixar), base para montar o framework do Design System. |
| **Canvas: Interações** | `ui/public/js/modules/prototype-canvas/canvas-interactions.js` | Mouse, roda (pan/zoom), arrastar, redimensionar, desenhar itens e atalhos de teclado. |
| **Canvas: Barra de ferramentas** | `ui/public/js/modules/prototype-canvas/canvas-toolbar.js` | Ferramentas (selecionar, mão, quadro, texto, nota, retângulo, código), zoom, duplicar, excluir e Iniciar. |
| **Canvas: Modo Iniciar** | `ui/public/js/modules/prototype-canvas/canvas-play.js` | Navegação "Iniciar": cada tela vira um quadro do canvas e os links `goto:` movem a câmera até o quadro de destino. |
| **Mapa em Camadas (Módulos)** | [`ui/public/js/modules/design-layers/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/design-layers/) | Arquitetura em 2 colunas: cabeçalho com métricas proporcionais (`layers-header`), etapas (`layers-stages-nav`), 6 abas (`layers-tabs-nav`), réplica interativa com marcadores amarelos (`layers-screen-replica`) e detalhes (`layers-detail-*.js`). |
| **Estado Persistido das Telas de Design** | `ui/public/js/modules/design-scrum-state.js`, `design-layers-state.js` e `design-audit.js` | Adotam o cliente de estado por tela nas telas de design: instantâneo, aplicação validada, hidratação única e persistência que preserva a ação do usuário feita antes do servidor responder (EP-14.09). |
| **Quadro de Componentes (Board)** | `ui/public/js/modules/design-board.js` | Kanban de componentes com filtro, agrupamento por etapa/funcionalidade, seleção de cartão e zoom (25–200%) persistidos por tela (EP-14.09). |
| **Peças do cartão do quadro** | `ui/public/js/modules/design-board-card-parts.js` | Selos do cartão (registrado no DS, etapa manual), linha de uso nos protótipos e barra de ferramentas do quadro; extraído do `design-board.js`. |
| **Window Manager (Fachada)** | [`ui/public/js/window-manager/window-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-manager.js) | Fachada unificada de gerenciamento de janelas e catálogo de módulos. |
| **Window Manager (Registro)** | [`ui/public/js/window-manager/window-registry.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-registry.js) | Catálogo de módulos abríveis com metadados e ícones FontAwesome (sem emojis). |
| **Window Manager (Store)** | [`ui/public/js/window-manager/window-store.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-store.js) | Store reativo de ciclo de vida de janelas (abertura, foco, minimização, restauração, zIndex e eventos). |
| **Window Manager (Adaptador)** | [`ui/public/js/window-manager/station-adapter.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/station-adapter.js) | Adaptador que conecta objetos 3D/2.5D ao WindowManager, drawer flutuante e botões com FontAwesome. |
| **Catálogo de Objetos do Escritório** | [`ui/public/js/office/office-object-catalog.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-object-catalog.js) e [`catalog/*.data.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/catalog/) | Catálogo canônico imutável de objetos 2.5D/3D (posições espaciais, aliases, ícones FontAwesome exclusivos e mapeamento com módulos). |
| **Motor 2.5D Isométrico** | [`ui/public/js/office-2d.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office-2d.js) e [`office2d/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office2d/) | Motor isométrico nativo (renderizador de chão/paredes, controlador do jogador e mobílias com ícones FontAwesome). |
| **Window Manager (Foco & Câmera)** | [`ui/public/js/window-manager/focus-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/focus-manager.js) | Gerencia foco ativo, camadas zIndex, bloqueio de movimentação de câmera (WASD/setas) e atalhos globais. |
| **Window Manager (Ciclo de Vida)** | [`ui/public/js/window-manager/window-lifecycle.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-lifecycle.js) | Gerenciador de ciclo de vida, persistência transiente de estado e execução de hooks de limpeza/descarte. |
| **Window Manager (Barra de Tarefas)** | [`ui/public/js/window-manager/taskbar.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/taskbar.js) | Componente da barra de tarefas inferior com alternância minimizar/restaurar e badges FontAwesome. |
| **Window Manager (Arraste & Redim.)** | [`ui/public/js/window-manager/drag-resize.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/drag-resize.js) | Controlador de movimentação por arraste de cabeçalho, alça de redimensionamento e duplo-clique para maximizar. |
| **Window Manager (Docking & Abas)** | [`ui/public/js/window-manager/docking-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/docking-manager.js) | Funções puras de layout, acoplamento em zonas de tela, detecção de snap e gerenciador de grupos de abas. |
| **Window Manager (Persistência)** | [`ui/public/js/window-manager/layout-persistence.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/layout-persistence.js) | Serialização versionada, `resourceId`, validação, confinamento e aplicação canônica com remapeamento de IDs. |
| **Window Manager (Responsivo)** | [`ui/public/js/window-manager/responsive-layout.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/responsive-layout.js) | Resolução de breakpoints (mobile/tablet/desktop), modo fullscreen adaptativo e sincronização reativa. |
| **Window Manager (Workspaces)** | [`ui/public/js/window-manager/workspace-presets.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/workspace-presets.js) | Fachada compatível e CRUD de workspaces customizados por projeto. |
| **Window Manager (Templates)** | `ui/public/js/window-manager/workspace-templates.js` | Catálogo imutável de Desenvolvimento, Planejamento, Qualidade e Operações, com IDs legados compatíveis. |
| **Window Manager (Sessão de Workspaces)** | `ui/public/js/window-manager/workspace-session.js` | Vincula layouts nomeados ao projeto central, controla o workspace ativo e publica snapshots observáveis sem dependência de DOM. |
| **Window Manager (Contexto Persistido)** | `ui/public/js/window-manager/workspace-persistence.js` | Persiste envelope versionado de layout, filtros e recursos por projeto e rejeita corrupção antes de alterar a store. |
| **Window Manager (Tipos)** | [`ui/public/js/types/window-manager.d.ts`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/types/window-manager.d.ts) | Tipagens estáticas estritas do Window Manager. |
| **Catálogo de Objetos do Escritório** | [`ui/public/js/office/office-object-catalog.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-object-catalog.js) | Catálogo canônico imutável de objetos 2.5D e 3D, ícones FontAwesome exclusivos, zero emojis, posições espaciais e vínculo com WindowManager (EP-03.01). |

### Folhas de Estilo CSS (`ui/public/css/`)

| Arquivo CSS | Conteúdo |
|---|---|
| [`ui/public/css/base.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/base.css) | Variáveis HSL de tema escuro/claro, reset, tipografia, botões base e diálogos nativos. |
| [`ui/public/css/components.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/components.css) | Header, tabela de conversas, filtros, chips de grupo, paginação e toasts. |
| [`ui/public/css/chat.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/chat.css) | Agregador modular: layout do diálogo, mensagens editoriais, cards de código acionáveis, compositor integrado, popovers, arena multi-motor e mini-dock. |
| [`ui/public/css/chat/05-chat-code-cards.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/chat/05-chat-code-cards.css) | Estilização dos cards de código, cabeçalhos, badges de extensão e botões de copiar e aplicar. |
| [`ui/public/css/chat/06-chat-system-cards.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/chat/06-chat-system-cards.css) | Estilização dos cartões de permissão MCP, avisos de erro e chips de anexos do chat. |
| [`ui/public/css/chat-mobile.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/chat-mobile.css) | Refinamentos responsivos de safe-area e alvos de toque para dispositivos móveis. |
| [`ui/public/css/studio.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/studio.css) | Workspace do Vibecoding Studio, molduras de viewport mobile/desktop e dock responsivo. |
| [`ui/public/css/review.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/review.css) | Interface de revisão de memória e cards de gerenciamento de skills. |
| [`ui/public/css/inspector.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/inspector.css) | Estilos do botão ativo, faixa de aviso do inspetor, card de resultado de componente e visualizador de código. |
| [`ui/public/css/design/06-workspace-prototypes.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/design/06-workspace-prototypes.css) | Estilos do workspace de 4 áreas (Catálogo, Chat, Preview e Inspetor), splitters e botões de colapso. |
| [`ui/public/css/design/07-layers-tree.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/design/07-layers-tree.css) | Estilos da árvore de camadas (Figma/XD), busca, recuo hierárquico, ícones por categoria e abas do inspetor. |
| `ui/public/css/design/08-prototype-catalog.css` | Catálogo unificado, componentes reutilizáveis, cabeçalho do preview, versões e estados do Ateliê. |
| `ui/public/css/design/13-prototype-canvas.css` | Estilo do canvas do Ateliê: câmera, quadros, ferramentas, blocos de código e modo Iniciar. |
| `ui/public/css/design/16-artifact-inventory.css` | Estilos da aba Artefatos: resumo, busca, filtros, tabela, estados e responsividade. |
| `ui/public/css/design/17-artifact-import.css` | Estilos dos botões, status e responsividade da importação de artefatos. |
| `ui/public/css/design/18-artifact-access.css` | Estilos do badge e da alternância de acesso local/projeto. |
| `ui/public/css/design/19-artifact-preview.css` | Estilos do botão de visualização, painel de prévia, iframe, texto e imagem. |
| `ui/public/css/design/20-artifact-relationships.css` | Estilos do painel de vínculos, lista de telas/campos, órfãos e seletor de destino. |
| [`ui/public/css/index.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/index.css) | Ponto de montagem central que importa os 6 arquivos de estilo via `@import`. |

# MAPA DO HARNESS LECA (Guia para Agentes e LLMs)

> **Finalidade deste arquivo:** Servir de índice direto para agentes (Claude Code, Gemini, Opencode) localizarem rapidamente arquivos e responsabilidades **sem varrer o repositório**, economizando tokens e evitando leitura de arquivos monolíticos.

---

## 🧭 1. Visão Geral da Arquitetura

```
harness-leca/
├── AGENTS.md                  # Regras globais para agentes LLM no início de cada tarefa
├── CLAUDE.md                  # Regras de projeto estilo Claude Chat e convenções gerais
├── MAPA.md                    # Este mapa de arquitetura e arquivos
├── SETUP.md                   # Instruções de instalação, comandos e rotinas
├── global/                    # Instruções e memórias compartilhadas por todos os projetos
│   ├── instructions.md
│   └── memory.md
├── projects/                  # Diretórios de projetos isolados
│   ├── .active                # Nome do projeto ativo (ex: 57multimarcas)
│   ├── .sources.json          # Apelidos de pastas para mapeamento de motores
│   └── <slug>/                # instructions.md, memory.md, chats/, context/, scheduled/
├── tools/                     # Scripts de CLI e automação do harness
│   ├── sync.js                # Sincronização centralizada dos motores importados
│   ├── export-context.js      # Exporta memórias e regras para o contexto dos agentes
│   ├── export-claude-sessions.js # Reidrata sessões do Claude Code (.jsonl) para claude --resume
│   ├── import-codex-chats.js  # Importa sessões locais do Codex para os chats do Harness
│   ├── import-ds-docs.js      # Recria o Design System (componentes, tokens e telas) a partir do dis-design-system.html
│   └── export-codex-sessions.js # Exporta chats do Harness como sessões JSONL do Codex
│   ├── extraction-state.js    # Gerencia estado da extração de conversas
│   ├── extract-artifacts.js   # Extrator de memórias via LLM
│   └── lib/                   # Bibliotecas compartilhadas (engines, state, network, dai)
└── ui/                        # Servidor HTTP local e interface web
    ├── server.js              # Entrypoint enxuto do servidor HTTP (~35 linhas)
    ├── server/                # Módulos desacoplados do backend
    │   ├── config.js          # Constantes, portas, PIN, headers e utilitários HTTP
    │   ├── router.js          # Tabela de rotas e despacho de requisições
    │   ├── services/          # Lógica de negócio (project.service.js)
    │   └── controllers/       # Handlers de req/res por domínio
    └── public/                # Interface web frontend (HTML, CSS e JS modular)
        ├── index.html         # Página principal da interface (872 linhas, sem JS/CSS embutido)
        ├── overview.html      # Visão geral de projetos (/overview)
        ├── diario.html        # Diário de atividade de conversas (/diario)
        ├── css/               # Folhas de estilo modularizadas
        │   ├── base.css       # Variáveis, reset, tipografia e diálogos
        │   ├── components.css # Cards, tabelas, filtros, paginação e cabeçalho
        │   ├── chat.css       # Balões de chat, grid comparativa, thinking e mini dock
        │   ├── studio.css     # Vibecoding workspace, preview canvas e mobile dock
        │   ├── review.css     # Revisão de memória e painel de skills
        │   └── index.css      # Ponto de entrada com imports dos módulos
        └── js/                # Módulos ES Modules nativos (Zero bundlers)
            ├── app.js         # Bootstrap da aplicação e registro global
            ├── shared/        # Utilitários compartilhados (dom, markdown, state, api)
            └── modules/       # Domínios (projects, chat, studio, groups, review, skills, services)
```

---

## 🛠️ 2. Onde Encontrar Cada Coisa (Backend `ui/server/`)

| Funcionalidade / Domínio | Arquivo Responsável | O que faz |
|---|---|---|
| **Entrypoint do Servidor** | [`ui/server.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server.js) | Cria o servidor HTTP (`createServer`), valida host/origem e ativa proxy HMR. |
| **Configuração & Utils HTTP** | [`ui/server/config.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/config.js) | Portas, PIN remoto, envio de respostas (`send`), leitura de JSON (`readJsonBody`). |
| **Roteador Principal** | [`ui/server/router.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/router.js) | Mapeamento de rotas Regex/String e delegação para controllers. |
| **Visão Geral de Projetos** | [`ui/server/controllers/overview.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/overview.controller.js) | Resumo paginado de atividade (`GET /api/overview`). |
| **Gestão de Projetos & Arquivos** | [`ui/server/controllers/project.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/project.controller.js) | Estado (`/api/state`), detalhes (`/api/project/:slug`), grupos e leitura segura de arquivos. |
| **Regras de Negócio de Projeto** | [`ui/server/services/project.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/project.service.js) | Leitura de metadados, contagem de chats, cache de estatísticas de conversas. |
| **Seleção Ativa de Projeto** | [`ui/server/services/project-selection.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/project-selection.service.js) | Canonicaliza slugs e substitui `projects/.active` atomicamente. |
| **Migração do Scrum** | `ui/server/services/project-scrum-migration.js` | Versiona o `scrum.json`, mapeia status para raias, cria backup, grava atomicamente e executa rollback. |
| **Catálogo e Ordem de Raias Scrum** | `ui/server/services/project-scrum-lanes.js` | Define as 12 raias canônicas, valida atributos e aceita somente uma permutação completa dos IDs com ordem contígua. |
| **Operações das Raias Scrum** | `ui/server/services/project-scrum-ops.js` e `ui/server/controllers/scrum.controller.js` | Persistem configuração e ordem com `lanesRevision`; rejeitam concorrência obsoleta com HTTP 409. |
| **Transições Scrum** | `ui/server/services/project-scrum-transitions.js` e `ui/server/controllers/scrum-transition.controller.js` | Validam a matriz canônica, raias ativas e origem esperada; persistem movimento e histórico atômico. |
| **Chat Interativo & Motores** | [`ui/server/controllers/chat.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/chat.controller.js) | SSE streaming (`/api/chat`), persistência (`/api/chat/save`), catálogo DAI e motores. |
| **Sincronização de Conversas** | [`ui/server/controllers/sync.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/sync.controller.js) | Disparo e streaming de logs de `tools/sync.js` (`POST /api/sync`). |
| **Revisão de Memória** | [`ui/server/controllers/review.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/review.controller.js) | Listagem, aprovação e descarte de sugestões extraídas (`/api/project/:slug/review`). |
| **Gerenciamento de Skills** | [`ui/server/controllers/skills.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/skills.controller.js) | CRUD de skills do projeto (`.agents/skills`), instalação de templates e importação. |
| **Serviços & Processos Dev** | [`ui/server/controllers/services.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/services.controller.js) | Início/parada de processos locais (Spring Boot, Vite) e stream de logs. |
| **Inspetor Angular (Controller)** | [`ui/server/controllers/inspect.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/inspect.controller.js) | Resolução de classes de componente Angular (`/api/project/:slug/inspect/resolve`) e leitura segura de código (`/api/project/:slug/inspect/file`). |
| **Inspetor Angular (Service)** | [`ui/server/services/component-resolver.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/component-resolver.service.js) | Varredura de arquivos `.ts`, análise de decorators `@Component`, extração de template/styles e confinamento estrito de paths. |
| **Código-fonte do Studio** | `ui/server/controllers/source-workspace.controller.js` e `ui/server/services/source-workspace.service.js` | Lista, lê e salva fontes do diretório da aplicação com confinamento de caminho, bloqueio de segredos e conflito por fingerprint. |
| **Acesso Remoto & PIN** | [`ui/server/controllers/remote.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/remote.controller.js) | Informações de QR Code, validação de PIN de celular e rede local. |
| **Arquivos Estáticos** | [`ui/server/controllers/static.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/static.controller.js) | Entrega segura de HTML, CSS, JS e imagens dentro de `ui/public/`. |
| **Design System Registry (Service)** | [`ui/server/services/design-registry.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/design-registry.service.js) | Catálogo canônico de componentes (`DesignSystemComponent`), validação de manifesto, suporte multiframework e persistência. |
| **Preview de Design System (Service)** | [`ui/server/services/design-preview.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/design-preview.service.js) | Renderização em sandbox isolada de componentes para inspeção e testes, com injeção limpa de tokens e props de demonstração. |
| **Extrator de Design System (Service)** | [`ui/server/services/design-extractor.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/design-extractor.service.js) | Decomposição semântica de componentes legados, extração de CSS e empacotamento modular do piloto `AnnotationList`. |
| **Design System Registry (Controller)** | [`ui/server/controllers/design-registry.controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/controllers/design-registry.controller.js) | Endpoints REST (`/api/project/:slug/design/registry`) para listagem, filtros, preview em sandbox (`/preview`) e extração de componentes. |
| **Prototype Schema V2 (Service)** | [`ui/server/services/prototype-schema.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-schema.service.js) | Criação, manipulação e normalização de nós semânticos (`PrototypeNode`), slots, eventos e indexação O(1). |
| **Prototype State & Mocks (Service)** | [`ui/server/services/prototype-state.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-state.service.js) | Gerenciamento de estado global e local, interpolação `{{var}}`, bindings e datasets de mock. |
| **Validador de Protótipos (Service)** | [`ui/server/services/prototype-validator.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-validator.service.js) | Validador estrito de integridade referencial, metadados, árvores de nós e destinos de navegação. |
| **Parser Semântico de Protótipo (Service)** | [`ui/server/services/prototype-semantic-parser.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-semantic-parser.service.js) | Analisa fragmentos e tags `<x-import>`, mapeando componentes globais DataChef para IDs canônicos do Registry. |
| **Decompositor de Telas (Service)** | [`ui/server/services/prototype-screen-decomposer.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-screen-decomposer.service.js) | Decompõe fluxos monolíticos em telas limpas independentes, gerando atributos `data-node-id` para inspeção visual 1:1. |
| **Reconstrutor de Protótipos (Service)** | [`ui/server/services/prototype-reconstructor.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-reconstructor.service.js) | Pipeline completo de reconstrução: gera `proto.json` v2.0.0, pastas `screens/`, `data/` e valida conformidade. |
| **Piloto DIS (Service)** | [`ui/server/services/prototype-pilot-dis.service.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/server/services/prototype-pilot-dis.service.js) | Recompõe de forma idempotente as três telas e a navegação do piloto DIS após a reconstrução semântica. |

---

## 🎨 3. Onde Encontrar Cada Coisa (Frontend `ui/public/`)

### Módulos JavaScript (`ui/public/js/`)

| Módulo | Arquivo Responsável | Responsabilidades |
|---|---|---|
| **Bootstrap & Entrypoint** | [`ui/public/js/app.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/app.js) | Ponto de entrada ES Modules, registro em `window` para compatibilidade e bindings globais. |
| **Utilitários de DOM** | [`ui/public/js/shared/dom.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/dom.js) | `$`, `esc`, `clean`, `fmt`, `autoGrow`, `copyToClipboard`, `openDlg`, toasts. |
| **Markdown & Parsers** | [`ui/public/js/shared/markdown.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/markdown.js) | `md(t)`, `parseChat(src)`, `renderChat(src)`, `parseFrontmatter(content)`. |
| **Parsing de Código & Tags** | [`ui/public/js/shared/markdown-code.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/markdown-code.js) | Extração de blocos `<arquivo caminho="...">` e crases com renderização de `.code-block-card`. |
| **Ações de Código do Chat** | [`ui/public/js/modules/chat-code-actions.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-code-actions.js) | Copiar código (`copyCodeFromContainer`) e aplicar granularmente no Ateliê de Protótipos (`applySingleAtelierFile`). |
| **Estado Global** | [`ui/public/js/shared/state.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/state.js) | Estado reativo `state`, persistência de rascunhos de chat e paleta de cores. |
| **Seleção Compartilhada de Projeto** | [`ui/public/js/shared/project-selection.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/project-selection.js) | Resolve precedência, sincroniza URL/storage/backend e publica trocas confirmadas de projeto. |
| **Alterações Não Salvas** | `ui/public/js/shared/unsaved-changes.js` | Registra pendências por projeto/workspace e bloqueia transições com erro estruturado. |
| **Cliente de API** | [`ui/public/js/shared/api.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/shared/api.js) | Fetch wrappers e leitor de streaming SSE (`readSSEStream`). |
| **Listagem & Projetos** | [`ui/public/js/modules/projects.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/projects.js) | `load(slug)`, busca, filtros por motor, ordenação, paginação e mapeamento de conversas. |
| **Grupos de Contexto** | [`ui/public/js/modules/groups.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/groups.js) | Criação, edição, subgrupos, tags de cores e sugestões de autoclassificação por LLM. |
| **Chat Interativo** | [`ui/public/js/modules/chat.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat.js) | Fachada agregadora do chat (motores, SSE streaming, persistência, mini-dock). |
| **Interação UI do Chat** | [`ui/public/js/modules/chat-ui-interaction.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-ui-interaction.js) | Menus de provedores, mais opções, configurações, ancoragem de rolagem nas 3 apresentações e compositor para Chat e Studio. |
| **Renderização do Chat** | [`ui/public/js/modules/chat-render.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-render.js) | Renderiza histórico nas 3 apresentações, arena comparativa com cronômetro, thinking colapsável e âncora inteligente de rolagem. |
| **Apresentações do Chat** | [`ui/public/js/modules/chat-presentations.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-presentations.js) | Contrato declarativo dos IDs, menus e controles compartilhados pelas apresentações principal, Studio e compacta (`mini`). |
| **Apresentação Compacta (Mini Dock)** | [`ui/public/js/modules/chat-mini.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-mini.js) e [`04-mini-chat-dock.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/chat/04-mini-chat-dock.css) | Mini-dock flutuante Picture-in-Picture com badge de motor, preview, streaming em tempo real, compositor autônomo e cancelamento. |
| **Modelos Canônicos de Chat** | [`ui/public/js/modules/chat-models.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-models.js) e [`chat-models.d.ts`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/types/chat-models.d.ts) | Entidades puras `ChatMessage`, `ChatSession` e `ChatExecutionState` com extração automática de blocos de código. |
| **Sessões do Chat** | [`ui/public/js/modules/chat-session-store.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-session-store.js) | Isola sessões dos motores por projeto e conversa, suportando os 4 motores canônicos e migração de drafts. |
| **Continuidade de Conversa** | [`ui/public/js/modules/chat-continue.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-continue.js) | Modal de continuação de conversas anteriores (`continueChatDlg`), busca, filtros por motor com FontAwesome e reset de sessão. |
| **Persistência de Chat** | [`ui/public/js/modules/chat-persist.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-persist.js) | Salvamento manual e automático no disco com migração de sessões de runtime e reidratação de histórico (`resumeExistingChat`). |
| **Execuções do Chat** | [`ui/public/js/modules/chat-execution-store.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-execution-store.js) | Ciclo de vida canônico de execução (`idle`, `streaming`, `waiting_approval`, `cancelled`, `error`), listeners reativos e cancelamento granular. |
| **Envio e Streaming de Chat** | [`ui/public/js/modules/chat-send.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-send.js) | Envio de mensagens em modo individual ou comparativo com AbortController isolado e sessões canônicas. |
| **Ciclo de Vida UI de Streaming** | [`ui/public/js/modules/chat-stream-ui.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-stream-ui.js) | Sincronização reativa de botões (envio/cancelar) nas 3 apresentações e cancelamento de stream. |
| **Feedback HIA no Chat** | [`ui/public/js/modules/chat-hia-feedback.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-hia-feedback.js) | Status de execução local, metadados da rota Script-First e contador de tokens economizados por sessão. |
| **Painel HIA do Chat** | [`ui/public/js/modules/chat-hia-panel.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/chat-hia-panel.js) | Módulo ES que consome `GET /api/hia/metrics` e renderiza telemetria, hardware e estado do roteamento no popover de configurações. |
| **Vibecoding Studio** | [`ui/public/js/modules/studio.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/studio.js) | Live preview da aplicação, iframe com HMR, alternador de viewports e conexão móvel. |
| **Layout e Splitter do Studio** | [`ui/public/js/modules/studio-layout.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/studio-layout.js) | Redimensionamento contínuo via Pointer Events, ARIA separator, teclado (setas, Home/End, PageUp/PageDown), duplo clique para reset (440px) e persistência isolada por projeto. |
| **Editor de Código do Studio** | `ui/public/js/modules/studio-source.js`, `studio-source-tree.js`, `studio-source-highlight.js` e `ui/public/css/studio/05-source-editor.css` | Árvore recolhível de diretórios, edição manual com realce por linguagem e linhas numeradas, Ctrl+S, guard de alterações pendentes, registro em `windowManager.unsaved` e hot-reload. |
| **Visualizações do Studio** | [`ui/public/js/modules/studio-views.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/studio-views.js) | Alterna Preview, Ateliê, Código e 2 Telas, normaliza aliases, monta conteúdo sob demanda, persiste por projeto e bloqueia a troca com alterações não salvas. |
| **Revisão de Memória** | [`ui/public/js/modules/review.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/review.js) | Diálogo de revisão de sugestões, promoção para `memory.md`, edição e descarte. |
| **Gerenciador de Skills** | [`ui/public/js/modules/skills.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/skills.js) | CRUD de skills `.agents/skills`, visualizador de `references/`, catálogo DAI e importação. |
| **Processos Dev** | [`ui/public/js/modules/services.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/services.js) | Início/parada de servidores de desenvolvimento locais e stream de logs em modal. |
| **Inspetor Angular** | [`ui/public/js/modules/inspector.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/inspector.js) | Modo inspetor visual no Studio com Ivy (`window.ng`), overlay de hover, atalho `Alt+I`, card de arquivos e injeção do bloco `<contexto-inspetor>` no chat. |
| **Layout de Protótipos** | [`ui/public/js/modules/prototype-workspace-layout.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/prototype-workspace-layout.js) | Gerenciamento de painéis redimensionáveis (4 áreas), splitters com drag, collapse e persistência. |
| **Catálogo de Protótipos** | `ui/public/js/modules/prototype-catalog.js` | Une artefatos HTML locais e protótipos editáveis do projeto, exibindo também componentes e boilerplates do MCP. |
| **View do Ateliê** | `ui/public/js/modules/prototype-atelier-view.js` | Renderiza a composição visual do Ateliê; o controlador `prototype-atelier.js` conserva somente estado e eventos. |
| **Árvore de Camadas** | [`ui/public/js/modules/prototype-layer-tree.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/prototype-layer-tree.js) | Modelo hierárquico navegável, busca de nós, expansão/recolhimento e sincronização bidirecional com preview. |
| **Canvas do Ateliê (Fachada)** | `ui/public/js/modules/prototype-canvas-mode.js` | Fachada do modo canvas: monta motor, interações, barra de ferramentas e Play; roteia mensagens da ponte por `event.source` e fala com o quadro selecionado. |
| **Canvas do Ateliê (Cola)** | `ui/public/js/modules/prototype-atelier-canvas.js` | Liga os botões Canvas/Iniciar do cabeçalho do Ateliê ao modo canvas e expõe roteamento de mensagens, `postMessage` e reload para o controlador. |
| **Inspetor do Ateliê** | `ui/public/js/modules/prototype-inspector-toggle.js` | Botão Inspetor liga/desliga contornos e seleção; desligado, as telas rodam ao vivo (modo play) tanto na tela única quanto no canvas. |
| **Canvas: Modelo** | `ui/public/js/modules/prototype-canvas/canvas-model.js` | Funções puras: documento, câmera (zoom no cursor, fit), itens, hit-test, ordem de navegação e validação do documento salvo. |
| **Canvas: Persistência** | `ui/public/js/modules/prototype-canvas/canvas-store.js` | Leitura/gravação do documento do canvas no `localStorage` por projeto e protótipo, com salvamento adiado. |
| **Canvas: Motor** | `ui/public/js/modules/prototype-canvas/canvas-engine.js` | Estado do canvas (documento, seleção, ferramenta, câmera) e DOM do mundo com os itens. |
| **Canvas: Itens** | `ui/public/js/modules/prototype-canvas/canvas-items-view.js` | Cria o DOM de quadros (iframes escalados com escudo), textos, notas e retângulos. |
| **Canvas: Blocos de código** | `ui/public/js/modules/prototype-canvas/canvas-code-block.js` | Bloco de código (editor, linguagem, preview HTML em sandbox, copiar e baixar), base para montar o framework do Design System. |
| **Canvas: Interações** | `ui/public/js/modules/prototype-canvas/canvas-interactions.js` | Mouse, roda (pan/zoom), arrastar, redimensionar, desenhar itens e atalhos de teclado. |
| **Canvas: Barra de ferramentas** | `ui/public/js/modules/prototype-canvas/canvas-toolbar.js` | Ferramentas (selecionar, mão, quadro, texto, nota, retângulo, código), zoom, duplicar, excluir e Iniciar. |
| **Canvas: Modo Iniciar** | `ui/public/js/modules/prototype-canvas/canvas-play.js` | Navegação "Iniciar": cada tela vira um quadro do canvas e os links `goto:` movem a câmera até o quadro de destino. |
| **Mapa em Camadas (Módulos)** | [`ui/public/js/modules/design-layers/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/modules/design-layers/) | Arquitetura em 2 colunas: cabeçalho com métricas proporcionais (`layers-header`), etapas (`layers-stages-nav`), 6 abas (`layers-tabs-nav`), réplica interativa com marcadores amarelos (`layers-screen-replica`) e detalhes (`layers-detail-*.js`). |
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
| [`ui/public/css/index.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/index.css) | Ponto de montagem central que importa os 6 arquivos de estilo via `@import`. |

## ⚡ 4. Motores de IA e Extratores (`tools/lib/`)

- [`tools/lib/engines/index.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/index.js): Registro unificado dos motores (`claude`, `gemini`, `opencode`). Todos seguem a interface `{ id, stream, status }`.
- [`tools/lib/engines/codex.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/engines/codex.js): Integra o CLI local do Codex, com retomada de sessão, modelo e intensidade de raciocínio.
- `tools/lib/claude-sync-sources.js`: Reconcilia sessões Claude duplicadas entre workspaces e escolhe uma fonte determinística antes do sync.
- [`tools/lib/dai.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/dai.js): Integração com o esquadrão DAI (17 agentes especialistas) e workflows.
- [`tools/lib/network.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/network.js): Descoberta de IPs locais, geração de QR Code ASCII/SVG e proxies WebSocket.
- [`tools/lib/proc-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tools/lib/proc-manager.js): Orquestrador de processos em background por projeto.

---

## 🧪 5. Como Rodar Testes

```bash
npm test                                           # Roda toda a suíte de testes (Node nativo)
node --test tests/chat-mobile-interaction.test.js  # Testa fidelidade mobile, menus e unificação de chat
node --test tests/server.test.js                   # Testa rotas do servidor HTTP
node --test tests/overview.test.js                 # Testa visão geral e sync
node --test tests/window-manager.test.js           # Testa catálogo, ciclo de vida e foco do Window Manager
node --test tests/design-registry.test.js          # Testa CRUD, validação de manifesto e rotas do Registry
node --test tests/design-tokens.test.js            # Testa variáveis CSS e temas semânticos
node --test tests/design-preview.test.js           # Testa sandbox e renderização isolada de componentes
node --test tests/marco-m1-validation.test.js      # Valida suíte completa do Marco M1 (Extração Confiável)
node --test tests/prototype-schema.test.js         # Testa schema v2, slots nomeados, indexação O(1) e navegação
node --test tests/prototype-state.test.js          # Testa resolução de estado, bindings, interpolação e mocks
node --test tests/prototype-validator.test.js      # Testa validador de integridade e diagnósticos de erros
node --test tests/prototype-canvas-model.test.js    # Testa o modelo do canvas (quadros, grade, câmera, hit-test, Play e persistência)
node --test tests/ds-docs-import.test.js            # Testa o gerador do DS (pids, navegação, scripts, extração)
node --test tests/renderer-components-css.test.js   # Testa a injeção de components.css (só com metadata.dsComponents)
node --test tests/prototype-semantic-parser.test.js # Testa parsing de tags x-import e extração de nós
node --test tests/prototype-screen-decomposer.test.js # Testa decomposição de telas e anotação de data-node-id
node --test tests/prototype-reconstruction.test.js # Testa reconstrução completa do protótipo DIS modular
```

---

## 🏢 6. Escritório Virtual Imersivo DAI HQ (`ui/public/office.html`)

| Funcionalidade / Domínio | Arquivo Responsável | O que faz |
|---|---|---|
| **Entrypoint do Escritório** | [`ui/public/js/office-app.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office-app.js) | Bootstrap dos motores 3D/2.5D, HUD, sensibilidade do mouse e atalhos. |
| **Fachada 3D Three.js** | [`ui/public/js/office-3d.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office-3d.js) | Orquestrador da cena 3D, câmeras, renderers e avatares. |
| **Controle de Câmera 3D** | [`ui/public/js/office3d/camera-controller.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office3d/camera-controller.js) | 1ª/3ª pessoa, sensibilidade calibrada (níveis 1 a 10) e suavização 1:1. |
| **Telão da War Room** | [`ui/public/js/office-war-screen.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office-war-screen.js) | Fachada do painel tático 1920x1080 com telemetria, workflows e jobs assíncronos. |
| **Submódulos da War Screen** | [`ui/public/js/office3d/war-screen/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office3d/war-screen/) | `war-screen-helpers.js`, `war-screen-workflows.js`, `war-screen-tasks.js`, `war-screen-agents.js`. |
| **Fachada 2.5D Retrô** | [`ui/public/js/office-2d.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office-2d.js) | Motor isométrico estilo Habbo desacoplado (< 180 linhas). |
| **Submódulos 2.5D** | [`ui/public/js/office2d/`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office2d/) | `map-objects.js`, `player-controller.js`, `iso-furniture.js`, `iso-scene-renderer.js`. |
| **Catálogo de Objetos do Escritório** | [`ui/public/js/office/office-object-catalog.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-object-catalog.js) | Fonte canônica única dos objetos 2.5D e 3D, ícones FontAwesome exclusivos, zero emojis e vinculação ao WindowManager (EP-03.01). |
| **Despachante de Ações dos Objetos** | [`ui/public/js/office/office-action-dispatcher.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-action-dispatcher.js) | Contrato padrão para 5 tipos de ação (`window`, `drawer`, `seat`, `screen_focus`, `custom`), som contextual e suporte legado (EP-03.02). |
| **Estado dos Agentes na Cena** | [`ui/public/js/office/office-agent-state.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-agent-state.js) | Catálogo canônico dos 4 motores, 6 estados, validação e assinatura de mudanças para 2.5D e 3D (EP-03.05). |
| **Telemetria dos Agentes** | [`ui/public/js/office/office-agent-telemetry.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/office/office-agent-telemetry.js) | Traduz execuções de chat, atividade periódica e estados transitórios para LEDs, balões, poses do Avatar3D e cor do pad (EP-03.05). |

---

### 6.1 Window Manager Híbrido (`ui/public/js/window-manager/`)

| **Janela de Chat do Escritório** | `ui/public/js/office/office-chat-window.js` | Reutiliza a Central de Chat em uma janela flutuante para continuar conversas salvas. |
| **Modal Continuar Conversa** | `ui/public/css/chat/07-continue-chat-modal.css` | Layout responsivo do seletor de conversas preservadas, com cabeçalho e filtros fixos. |

| Funcionalidade / Domínio | Arquivo Responsável | O que faz |
|---|---|---|
| **Tipagens do Window Manager** | [`ui/public/js/types/window-manager.d.ts`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/types/window-manager.d.ts) | Definições de tipos e interfaces (`WindowModule`, `WindowInstance`, `WindowState`). |
| **Catálogo de Módulos** | [`ui/public/js/window-manager/window-registry.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-registry.js) | Registro com 11 módulos padrão, metadados, títulos e ícones FontAwesome. |
| **Store Reativo de Janelas** | [`ui/public/js/window-manager/window-store.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-store.js) | Estado de janelas abertas, zIndex, singleton vs multi-instância e ouvintes reativos. |
| **Fachada do Window Manager** | [`ui/public/js/window-manager/window-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-manager.js) | Fachada pública do Window Manager (`open`, `close`, `focus`, `minimize`, `maximize`). |
| **Adaptador de Estações** | [`ui/public/js/window-manager/station-adapter.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/station-adapter.js) | Conecta objetos do escritório 3D/2.5D ao Window Manager com suporte a drawer e janela flutuante. |
| **Focus Manager & Bloqueio** | [`ui/public/js/window-manager/focus-manager.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/focus-manager.js) | Regras de foco, bloqueio de movimentação WASD/setas, camadas zIndex e tecla Escape. |
| **Ciclo de Vida & Recursos** | [`ui/public/js/window-manager/window-lifecycle.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/window-lifecycle.js) | Hooks de fechamento (cleanup), liberação de memória e preservação de estado transiente. |
| **Barra de Tarefas (Taskbar)** | [`ui/public/js/window-manager/taskbar.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/taskbar.js) | Componente visual de taskbar, controle de foco, alternância de minimização e fechar. |
| **Arraste e Redimensionamento** | [`ui/public/js/window-manager/drag-resize.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/js/window-manager/drag-resize.js) | Cálculo de limites confinados em viewport, arraste por cabeçalho e alça de resize. |
| **Estilos da Barra de Tarefas** | [`ui/public/css/office/12-taskbar.css`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/ui/public/css/office/12-taskbar.css) | Estilo glassmorphism dark para janelas ativas e minimizadas com FontAwesome. |
| **Testes do Window Manager** | [`tests/window-manager.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/window-manager.test.js) | Validação unitária do catálogo, foco, camadas zIndex e ciclo de vida. |
| **Testes de Workspaces** | `tests/workspace-templates.test.js`, `tests/workspace-presets.test.js`, `tests/workspace-session.test.js`, `tests/workspace-persistence.test.js` e `tests/unsaved-changes.test.js` | Validação de templates, CRUD, snapshot composto, isolamento, restauração e bloqueio de transições sujas. |
| **Testes do Adaptador de Estações** | [`tests/station-adapter.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/station-adapter.test.js) | Validação de mapeamento de objetos, layout lateral e alternância flutuante. |
| **Testes do Focus Manager** | [`tests/focus-manager.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/focus-manager.test.js) | Validação unitária de detecção de inputs, foco de janelas e interceptação de Escape. |
| **Testes do Ciclo de Vida** | [`tests/window-lifecycle.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/window-lifecycle.test.js) | Validação unitária de minimização, restauração, hooks de cleanup e preservação. |
| **Testes da Barra de Tarefas** | [`tests/taskbar.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/taskbar.test.js) | Validação de modelo de itens, ações de clique (toggle minimize/restore) e fechar. |
| **Testes de Arraste e Resize** | [`tests/drag-resize.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/drag-resize.test.js) | Validação unitária de confinamento em viewport, arraste, resize e duplo clique. |
| **Testes do Design Registry** | [`tests/design-registry.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-registry.test.js) | Validação unitária de manifestos, CRUD de componentes, frameworks e piloto `AnnotationList`. |
| **Testes de Rotas do Registry** | [`tests/design-registry-routes.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-registry-routes.test.js) | Validação de integração dos endpoints REST `/api/project/:slug/design/registry`. |
| **Testes de Tokens e Preview** | [`tests/design-tokens.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-tokens.test.js), [`tests/design-preview.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-preview.test.js) | Isolamento de CSS tokens/theme e sandbox de preview com ES modules. |
| **Homologação Marco M1** | [`tests/marco-m1-validation.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/marco-m1-validation.test.js) | Suíte de validação formal do Marco M1 (Extração Confiável). |
| **Prototype Schema & Estado** | [`tests/prototype-schema.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-schema.test.js), [`tests/prototype-state.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-state.test.js), [`tests/prototype-validator.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-validator.test.js) | Validação formal de schema v2, estado hierárquico e mocks clínicos do DIS. |
| **Reconstrução Semântica** | [`tests/prototype-semantic-parser.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-semantic-parser.test.js), [`tests/prototype-screen-decomposer.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-screen-decomposer.test.js), [`tests/prototype-reconstruction.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-reconstruction.test.js) | Parsing semântico de tags x-import, decomposição de telas e rebuild de protótipo limpo. |
| **Sandbox Renderer & Bridge** | [`tests/prototype-sandbox-renderer.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-sandbox-renderer.test.js), [`tests/prototype-bridge.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-bridge.test.js), [`tests/prototype-layer-tree.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-layer-tree.test.js) | Renderizador em sandbox seguro com CSP restritivo, ponte bidirecional postMessage e árvore de camadas. |
| **Canvas do Ateliê** | [`tests/prototype-canvas-model.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-canvas-model.test.js) | Documento do canvas: um quadro por tela, zoom no cursor, enquadramento, hit-test, ordem do Play, persistência e preview de blocos. |
| **Homologação Marco M2** | [`tests/marco-m2-validation.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/marco-m2-validation.test.js) | Suíte de homologação formal do Marco M2 (Protótipo Inspecionável com mutação não destrutiva). |
| **Adaptadores Multiframework** | [`tests/prototype-codegen-vanilla.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-codegen-vanilla.test.js), [`tests/prototype-codegen-angular.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-codegen-angular.test.js), [`tests/prototype-codegen-react.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-codegen-react.test.js), [`tests/prototype-codegen-parity.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-codegen-parity.test.js) | Geração de código limpo para Vanilla (HTML/CSS/JS), Angular 18 (Signals & Standalone) e React 18+ (Hooks & TSX) com matriz de paridade semântica. |
| **Studio & Rastreabilidade** | [`tests/prototype-studio.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-studio.test.js), [`tests/prototype-traceability.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-traceability.test.js) | Projeção de workspace virtual com hashes SHA-256 no Studio e resolução do grafo Tela -> Nó -> Componente -> Código. |
| **Piloto DIS Completo** | [`tests/prototype-pilot-dis.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/prototype-pilot-dis.test.js) | Fluxo clínico DIS funcional com 3 telas (`home`, `prescricao`, `autorizacao`), navegação circular e datasets reais. |
| **Homologação Marco M3** | [`tests/marco-m3-validation.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/marco-m3-validation.test.js) | Suíte de homologação formal do Marco M3 (Studio Multiframework) consolidando 100% do EP-12. |
| **Testes das Fontes Scrum** | [`tests/project-scrum-sources.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/project-scrum-sources.test.js) | Garante normalização fiel do Jira, parsing documental ordenado, reconciliação sem defaults fictícios e compatibilidade do mapeamento legado. |
| **Testes da Migração Scrum** | `tests/project-scrum-migration.test.js` | Cobre schema v2, idempotência, status desconhecido, backup, escrita atômica, rollback e coerência de raia. |
| **Testes das Raias Scrum** | `tests/project-scrum-lanes.test.js` e `tests/project-scrum-lane-order.test.js` | Cobrem catálogo, configuração, permutação, persistência, revisão otimista e invariantes das histórias em diretórios temporários. |
| **Testes da Ordem na UI Scrum** | `tests/design-scrum-lane-order.test.js` | Valida raias ocultas, endpoint compartilhado, controles acessíveis, anúncio e restauração de foco. |
| **Testes das Transições Scrum** | `tests/project-scrum-transitions.test.js` e `tests/design-scrum-transitions.test.js` | Cobrem matriz, status legado, histórico, conflito, origem Jira, drag, teclado, foco e anúncios. |
| **Seleção Central de Projeto** | [`tests/project-selection.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/project-selection.test.js) | Cobre precedência, canonicalização, persistência, rollback e escrita atômica do projeto ativo. |
| **Testes da UI Scrum** | [`tests/design-scrum-details.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/design-scrum-details.test.js) | Valida painel, projeção dinâmica por `laneId`, modal acessível, relacionamentos e mapeamento de status. |
| **Sincronização de Execuções do Chat** | [`tests/chat-execution-sync.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/chat-execution-sync.test.js) | Valida ciclo de vida canônico (`idle`, `streaming`, `waiting_approval`, `cancelled`, `error`), observabilidade reativa e cancelamento granular. |
| **Catálogo de Objetos do Escritório** | [`tests/office-object-catalog.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/office-object-catalog.test.js) | Valida schema imutável dos objetos 2.5D/3D, zero emojis, aliases e integração com WindowManager (EP-03.01). |
| **Despachante de Ações do Escritório** | [`tests/office-action-dispatcher.test.js`](file:///c:/Users/matheuss.rodrigues/git/harness-leca/tests/office-action-dispatcher.test.js) | Cobre os 5 tipos de ação (window, drawer, seat, screen_focus, custom), som contextual e retrocompatibilidade (EP-03.02). |


---

## 7. Arquivos divididos por tamanho (fachada + módulos)

Arquivos que passavam de 300 linhas viraram uma fachada fina (mesmos nomes exportados) mais módulos especializados. Procure o código nos módulos, não na fachada.

| Fachada | Módulos |
|---|---|
| `tools/lib/skills.js` | `tools/lib/skills/` (`frontmatter`, `targets`, `reader`, `writer`, `templates`, `recognized`, `catalog-web`, `catalog-api`) |
| `tools/lib/proc-manager.js`, `network.js`, `qrcode.js` | `proc-manager-*.js`, `network-*.js`, `qrcode-*.js` na mesma pasta (`*-store.js` guarda o estado compartilhado) |
| `tools/import-gemini-chats.js` | `tools/lib/gemini-import/` (`text`, `sessions`) |
| `ui/server/services/project-scrum.service.js`, `project-screens.service.js`, `component-resolver.service.js`, `template-locator.service.js` | `project-scrum-*`, `project-screens-*`, `component-resolver-*`, `template-locator-*` na mesma pasta |
| Fontes e reconciliação do Scrum | `project-scrum-jira-source.js` lê o snapshot; `project-scrum-doc-source.js` interpreta histórias; `project-scrum-resolver.js` compõe com o estado local |
| Configuração e ordem de raias Scrum | `project-scrum-lanes.js` valida catálogo/permutação; `design-scrum-lane-config.js` configura atributos; `design-scrum-lane-order-model.js` calcula a ordem visível; `design-scrum-lane-order.js` controla rede/drag/teclado; estilos em `css/design/10-scrum-lanes.css` e `11-scrum-lane-order.css` |
| Movimentação de histórias Scrum | `project-scrum-transitions.js` contém as regras; `design-scrum-story-transition.js` integra endpoint, drag, botões, anúncio e foco; histórico no drawer e estilos em `css/design/12-scrum-story-transitions.css` |
| `ui/server/services/orchestration/event-engine.js` | `event-engine-projection.js` (mixin com a projeção de eventos) |
| `ui/public/js/modules/design-layers.js` | `ui/public/js/modules/design-layers/` (`layers-header`, `layers-stages-nav`, `layers-tabs-nav`, `layers-screen-replica`, `layers-screen-replica-s2`, `layers-screen-replica-s3`, `layers-screen-replica-s4`, `layers-right-content`, `layers-detail-ui-rules`, `layers-detail-api-data`, `layers-detail-tests-legacy`, `layers-state`) |
| `ui/public/js/modules/chat.js`, `inspector.js`, `design-scrum.js`, `design-audit.js`, `groups.js`, `projects.js`, `skills.js`, `studio.js` | módulos `<nome>-*.js` na mesma pasta; `<nome>-store.js` guarda o estado mutável compartilhado |
| Detalhes de história Scrum | `design-scrum-story-card.js`, `design-scrum-story-drawer.js` e `design-scrum-status-mapping.js`; estilos em `css/design/09-scrum-story-details.css` |
| `ui/public/js/deploy/` | `main.js` (entrada), `deploy-*.js` e `deploy-store.js` |
| `ui/public/js/office-3d.js`, `office-screen.js`, `office3d/world-*.js` | mixins `office-3d-controls`, `office-screen-*`, `office3d/war-room-*`, `office3d/workspace-*` |
| `ui/public/index.html` | blocos em `ui/public/partials/`, carregados por `ui/public/js/boot.js` antes do `app.js` |
| `ui/public/overview.html` | `css/overview.css` e `js/overview.js` |
| `ui/public/css/*.css` grandes | agregador `css/<nome>.css` importa `css/<nome>/NN-*.css` em ordem |
| `SETUP.md` | `docs/setup/` (importadores, rotinas e sync, interface e desenvolvimento) |

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

## 8. Planejamento da evolução do produto

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-evolution/README.md` | Índice, resumo executivo e checkpoint da Fase 0. |
| `docs/harness-evolution/01-current-state-audit.md` | Inventário da arquitetura, fluxos e restrições. |
| `docs/harness-evolution/02-requirements-and-gaps.md` | Problemas, evidências, soluções, riscos e validações. |
| `docs/harness-evolution/03-target-architecture.md` | Arquitetura-alvo, contratos e trade-offs. |
| `docs/harness-evolution/04-chat-studio-design-system.md` | Chat universal, Studio e foundations visuais. |
| `docs/harness-evolution/05-product-domains.md` | Kanban, Mapa, Componentes, Auditoria e AI-First. |
| `docs/harness-evolution/06-data-security-tests.md` | Migração/rollback, segurança e testes. |
| `docs/harness-evolution/07-roadmap-risks-acceptance.md` | Fases, riscos e critérios de aceite. |
| `docs/harness-evolution/08-prioritized-backlog.md` | HAR-001 a HAR-019 com escopo e validação. |
| `docs/PLAN-unificacao-atividade-interface-deploy.md` | Plano integrado das correções de Dashboard, Visão Geral, Diário e Deploy, com diagnóstico, fases, aceite, arquivos e testes. |
| `docs/harness-evolution/09-activity-interface-deploy-index.md` | Índice multiagente das correções: ondas paralelas, ownership exclusivo, dependências, gates, handoffs e estimativas por camada. |
| `docs/PLAN-commit-atomico.md` | Plano de fatiamento da worktree em 21 commits temáticos: diagnóstico, baseline, blocos, arquivos-hub, riscos e checkpoints. |
| `docs/harness-evolution/implementation-progress.md` | Controle vivo por fase, evidências, pendências e próximo passo. |
| `docs/harness-evolution/00-index.md` | Índice mestre do programa: 13 épicos (EP-00 a EP-12), dependências e backlog de entregas. |
| `docs/harness-evolution/01-architecture/` | Estado atual (foco no escritório), arquitetura-alvo da apresentação compartilhada e mapa de dependências. |
| `docs/harness-evolution/02-epics/EP-XX-*/README.md` | Objetivo, execução, entrega, aceite e histórias de cada épico (EP-00 a EP-12). |
| `docs/harness-evolution/02-epics/EP-05-scrum/05-dev-notas.md` | Arquitetura das fontes reais do DIS, decisões de proveniência e evidências de validação. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.01-migracao-compativel-status.md` | Contrato e aceite da migração versionada de status para raias. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.02-doze-raias-configuraveis.md` | História, critérios de aceite, arquitetura e evidências das 12 raias configuráveis. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.03-reordenacao-horizontal.md` | História, critérios de aceite e evidências da ordem persistida e concorrência otimista das raias. |
| `docs/harness-evolution/02-epics/EP-05-scrum/05.04-movimentacao-transicoes.md` | Contrato, critérios e evidências das transições auditáveis de histórias. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/05-dev-notas.md` | Decisões e evidências da seleção, persistência e templates de workspace. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.02-layouts-nomeados.md` | Contrato, aceite e evidências dos layouts nomeados publicados pelo Window Manager. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.03-persistencia-contexto-workspace.md` | Contrato e aceite do snapshot de janelas, filtros e recursos selecionados por projeto. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.04-templates-workspace.md` | Contrato e aceite dos quatro templates canônicos de workspace. |
| `docs/harness-evolution/02-epics/EP-04-projetos-workspaces/04.05-protecao-alteracoes-nao-salvas.md` | Contrato, aceite e handoff do guard compartilhado de alterações não salvas. |
| `docs/harness-evolution/02-epics/EP-09-observabilidade/` | Dossiê da Central de Sessões: diagnóstico, reuso, capacidades, modelo canônico, workflow, eventos, UI, integração e roadmap. |
| `docs/harness-evolution/03-decisions/ADR-004-*.md` a `ADR-006-*.md` | Decisões propostas do registro canônico, persistência SQLite e estados ortogonais. |
| `docs/harness-evolution/04-test-plans/TP-09-central-sessoes.md` | Critérios de aceite e estratégia de testes da Central de Sessões e Orquestração. |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/` | EP-12 Prototype Engine & Design System Multiframework (README, arquitetura, contratos, fases F0-F7, histórias e relatórios F0). |
| `docs/harness-evolution/02-epics/EP-12-prototype-engine/05-dev-notas.md` | Notas consolidadas da implementação do EP-12, decisões preservadas, evidências dos Marcos M1-M3 e pendências transversais. |
| `docs/harness-evolution/02-epics/EP-00-auditoria/00.0X-*.md` e `EP-01-window-manager/01.XX-*.md` | Histórias no contrato padrão, prontas para detalhar. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.03-apresentacao-compacta.md` | Especificação e aceite da apresentação compacta (dock flutuante/PiP). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.04-apresentacao-lateral.md` | Especificação e aceite da apresentação lateral (sidebar do Studio e resizer). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.05-apresentacao-completa.md` | Especificação e aceite da apresentação completa (modal central e arena multi-motor). |
| `docs/harness-evolution/02-epics/EP-02-chat/02.06-historico-continuidade.md` | Especificação e aceite de sessões multi-motor e modal de continuidade. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.07-rolagem-ancorada.md` | Especificação e aceite de rolagem ancorada e botões nas 3 apresentações. |
| `docs/harness-evolution/02-epics/EP-02-chat/02.08-sincronizacao-estados.md` | Especificação e aceite de sincronização com estados reais de execução e hardening. |
| `docs/harness-evolution/02-epics/EP-01-window-manager/piloto-estacao-gemini.md` | Plano, aceite e riscos do piloto do Window Manager. |
| `docs/harness-evolution/03-decisions/README.md` | Índice de ADRs. |
| `docs/harness-evolution/04-test-plans/README.md` | Índice de planos de teste e comandos. |
| `docs/harness-evolution/05-progress/progress.md` | Status real por épico (60/104) e registro de entregas. |
| `docs/harness-evolution/05-progress/multi-agent-sync.md` | Painel oficial de divisão, dependências e handoffs entre os chats Gemini/Antigravity e Codex. |
| `docs/harness-evolution/_templates/` | Modelos de história, ADR e plano de teste. |

---

## 9. Projeto 57multimarcas: configuração Maven local (`57multimarcas-api/`)

Fora deste repositório (workspace `C:/Users/matheuss.rodrigues/git/57multimarcas`). Serve para o build local não cair no proxy/Nexus da Procempa sem afetar o deploy da VPS.

| Caminho | Responsabilidade |
|---|---|
| `57multimarcas-api/settings-sandbox.xml` | Settings do Maven com repositórios públicos (sem o proxy empresarial). |
| `57multimarcas-api/.mvn/maven.config` | Local, ignorado pelo git e pelo Docker. Contém `-s settings-sandbox.xml` para todo `mvn`/`./mvnw` da máquina. |
| `57multimarcas-api/.dockerignore` | Impede que o `.mvn/maven.config` entre na imagem; o build da VPS usa o settings padrão. |
| `57multimarcas-api/.gitignore` | Ignora `.mvn/maven.config`. |

## 10. Inspeção de artefatos de protótipo

| Caminho | Responsabilidade |
|---|---|
| `ui/server/services/prototype-artifact-import.service.js` | Converte um artefato HTML estático em cópia modular editável, mantendo a origem intacta. |

## 11. Skills locais

| Caminho | Responsabilidade |
|---|---|
| `.agents/skills/preparar-chat-sincronizacao/` | Prepara uma conversa em prévia revisável de projeto, grupo, contexto, decisões e pendências antes da sincronização. |
| `.agents/skills/harness-intelligence/` | Skill DAI (contrato v2) que conduz as fases F0 a F7 da iniciativa Intelligence & Automation; espelho de `../dai/skills/orquestracao/harness-intelligence/`. |

## 12. Coordenação automática de agentes

| Caminho | Responsabilidade |
|---|---|
| `tools/coordination.js` | CLI de init, sync, status, claim, start, heartbeat, block, complete, handoff, notify e inbox. |
| `tools/lib/coordination/` | Configuração dos quatro provedores, importação do backlog, reducer, lock/persistência e projeções. |
| `projects/<slug>/coordination/state.json` | Ledger canônico versionado do projeto. |
| `projects/<slug>/coordination/events/*.jsonl` | Auditoria append-only separada pela origem do evento. |
| `projects/<slug>/coordination/inbox/*.md` | Caixas de entrada geradas para Claude, Gemini, OpenCode e Codex. |
| `projects/<slug>/context/coordination.md` | Resumo gerado carregável por qualquer agente no início da tarefa. |
| `docs/harness-evolution/03-decisions/ADR-007-ledger-coordenacao-agentes.md` | Decisão arquitetural e alternativas do protocolo. |

## 13. Intelligence & Automation

| Caminho | Responsabilidade |
|---|---|
| `docs/harness-intelligence/README.md` | Índice do dossiê da iniciativa (Script-First, Local-First, Cloud-on-Demand) e estado de cada documento. |
| `docs/harness-intelligence/01-current-state-audit.md` | F0: auditoria de motores, contexto injetado, métricas, infraestrutura e oportunidades, com fatos separados de hipóteses. |
| `docs/harness-intelligence/02-target-architecture.md` | F1: arquitetura pretendida em 5 pilares, módulos, fluxo de execução e integração com motores existentes. |
| `docs/harness-intelligence/03-technical-decisions.md` | F1: ADRs técnicas de contratos (ADR-HIA-001), fan-out de subagentes (ADR-HIA-002), política de fallback (ADR-HIA-003) e runtime Ollama (ADR-HIA-004). |
| `docs/harness-intelligence/04-implementation-backlog.md` | F1: backlog detalhado HIA-001 a HIA-014 com dependências, critérios de aceite e prioridades. |
| `docs/harness-intelligence/06-security-and-quality.md` | F1: governança de segurança (allowlist, path traversal, ofuscação de segredos) e qualidade (anti-monólito < 300 linhas, FontAwesome). |
| `schemas/hia-task.schema.json` | F1: contrato canônico JSON Schema (Draft-07) para definição de tarefas e intenções no HIA. |
| `schemas/hia-execution.schema.json` | F1: contrato canônico JSON Schema para telemetria e registros de execução de tarefas. |
| `schemas/hia-tool.schema.json` | F1: contrato canônico JSON Schema para o Automation Registry (scripts determinísticos seguros). |
| `schemas/hia-model.schema.json` | F1: contrato canônico JSON Schema para o Model Registry (capacidades, requisitos de RAM/CPU e custos). |
| `tools/hia.js` | F2: CLI de inspeção e execução segura de ferramentas do Automation Registry (`npm run hia`). |
| `tools/lib/hia/registry.js` | F2: catálogo declarativo de ferramentas determinísticas do Harness com validação de schemas. |
| `tools/lib/hia/executor.js` | F2: executor seguro com sandbox de caminhos, sanitização de comandos, métricas de tempo e timeouts. |
| `tests/hia-registry.test.js` | F2: suíte de testes unitários do Automation Registry e salvaguardas de execução. |
| `tools/lib/hia/context-engine.js` | F3: Context Engine seletivo com escopos (minimal/project_only/full), fatiador do MAPA.md e estimativa de tokens. |
| `tools/lib/hia/index-cache.js` | F3: cache em memória com hashes SHA-256 para indexação incremental de arquivos de contexto. |
| `tests/hia-context.test.js` | F3: suíte de testes unitários do Context Engine, escopos e fatiamento sob demanda. |
| `tools/lib/hia/hardware-profiler.js` | F4: medidor de capacidade da CPU AMD Ryzen 5 e RAM host com alocação segura de threads e alerta de RAM livre. |
| `tests/hia-hardware.test.js` | F4: testes unitários do profiler de hardware e limites de segurança. |
| `tools/lib/engines/ollama.js` | F4: adaptador de motor local Ollama em CPU com streaming SSE, guard de RAM e listagem de modelos. |
| `tests/hia-ollama.test.js` | F4: testes unitários do motor Ollama e tratamento resiliente de erros de daemon. |
| `docs/harness-intelligence/05-benchmark-plan.md` | F4: plano de benchmark e critérios empíricos de avaliação para modelos locais. |
| `tests/fixtures/benchmark/intent-classification.json` | F4: dataset versionado para benchmark de classificação de intenção e extração. |
| `tools/lib/hia/benchmark.js` | F4: runner automatizado de benchmark de modelos locais contra datasets versionados. |
| `tests/hia-benchmark.test.js` | F4: testes unitários do benchmark runner. |
| `tools/lib/hia/model-registry.js` | F5: catálogo canônico de modelos, contextos, tiers e capacidades técnicas. |
| `tools/lib/hia/router.js` | F5: roteador inteligente em camadas (Script-First -> Local-First -> Cloud) com feature flag `HIA_ROUTING_ENABLED`. |
| `tests/hia-router.test.js` | F5: testes unitários de decisão de roteamento e desativação por flag. |
| `tools/lib/hia/guard.js` | F6: Resource Governor (concorrência máxima = 1 para CPU) e detector de repetição em loop. |
| `tools/lib/hia/telemetry.js` | F6: persistência de telemetria em JSONL com métricas de execuções e tokens economizados. |
| `tests/hia-guard.test.js` | F6: testes unitários do Execution Guard, concorrência e telemetria. |
| `ui/server/controllers/hia.controller.js` | F7: endpoint REST `GET /api/hia/metrics` expondo telemetria, hardware e configuração do roteador. |
| `ui/server/services/hia-chat-dispatcher.service.js` | F7: despachante de chat que intercepta automações determinísticas (Script-First) antes de consumir cota de nuvem. |
| `ui/public/js/modules/hia-dashboard.js` | F7: módulo que agrega payload de métricas HIA para uso pelo frontend do Harness. |
| `ui/public/css/hia-dashboard.css` | F7: estilos do painel de métricas com design tokens do Harness, zero emojis, ícones FontAwesome. |

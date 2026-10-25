# MAPA DO HARNESS LECA (Guia para Agentes e LLMs)

> **Finalidade deste arquivo:** Porta de entrada para agentes (Claude Code, Codex, Gemini, opencode) localizarem arquivos e responsabilidades **sem varrer o repositório**. A visão geral está abaixo; o detalhe por área está em `docs/mapa/` (veja o índice).

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
│   ├── export-context.js      # Fachada do export de memória curada para os motores (destinos em tools/lib/export/)
│   ├── adopt-project.js       # Adota uma pasta existente: detecta a stack, cria projects/<slug> com instructions.md e memory.md e grava o apelido em .sources.json (lib em tools/lib/adopt/)
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

## Índice dos mapas por área (leia só o arquivo da área que você precisa)

> Este arquivo é só a porta de entrada. O detalhe de cada área fica em `docs/mapa/`, dividido para caber em poucos tokens. Abra a linha da tabela que corresponde à tarefa e leia apenas esse arquivo.

| Arquivo | Seções | Conteúdo | Tamanho |
|---|---|---|---|
| `docs/mapa/02-backend.md` | 2 | Backend `ui/server/`: controllers, services, routes (projects, Scrum, chat, sync, design registry, prototype engine, artifacts, orchestration, deploy, screen state) | 18.7 KB |
| `docs/mapa/03-frontend-js-canvas-office-css.md` | 3 (3/3) | Frontend JS: canvas, design board, window manager, office; CSS files | 15.4 KB |
| `docs/mapa/03-frontend-js-core-chat-studio.md` | 3 (1/3) | Frontend JS: bootstrap, shared state, chat, Studio, review, skills, services | 13.0 KB |
| `docs/mapa/03-frontend-js-design-atelier.md` | 3 (2/3) | Frontend JS: inspector, artifacts, routines, Atelier, props panel, delete/history | 12.6 KB |
| `docs/mapa/04-engines-and-tests.md` | 4, 5 | AI engines and extractors (`tools/lib/`); how to run tests | 6.9 KB |
| `docs/mapa/06-office-3d.md` | 6 | DAI HQ virtual office (`ui/public/office.html`) | 9.7 KB |
| `docs/mapa/06-office-window-manager.md` | 6.1 | Hybrid Window Manager (`ui/public/js/window-manager/`) | 15.6 KB |
| `docs/mapa/07-split-files-and-features.md` | 7 | Files split by size (facade + modules), Jira, setup docs, getting started, adoption, prototype catalog, Design System recreation | 8.7 KB |
| `docs/mapa/08-planning-and-projects.md` | 8, 9 | Product evolution planning; 57multimarcas local Maven setup | 8.0 KB |
| `docs/mapa/10-artifacts-skills-coordination.md` | 10, 11, 12 | Artifact inspection, preview and links; local skills; agent coordination | 8.3 KB |
| `docs/mapa/13-intelligence-runtime-sessions.md` | 13, 14, 15 | HIA (Intelligence & Automation), Local AI Runtime, canonical session registry | 11 KB |
| `docs/mapa/16-telemetry-program.md` | 16 | Telemetry program: plan, diagnostics, ADRs, event log, presence, bridges, office projection, sessions | 11.5 KB |
| `docs/mapa/18-telemetry-usage-workflows.md` | 18 | Telemetry usage, pricing and workflow instrumentation: pricing, per-call usage ingest, Consumo tab, OpenCode detection, tool_use parser, workflow attempts | 8.8 KB |
| `docs/mapa/17-atelier-quality-pilot.md` | 17 | Atelier quality pilot: approval plan, Stage 0 audit and baseline | 1 KB |

### Como atualizar o mapa

- Ao criar, mover, dividir ou remover arquivos, acrescente ou ajuste a linha na tabela da área correspondente em `docs/mapa/` (não neste arquivo).
- Mantenha cada arquivo de `docs/mapa/` abaixo de ~20 KB. Ao passar disso, divida por tema e acrescente a linha no índice acima.
- O pre-commit (`scripts/pre-commit.js`) e o fatiador do HIA (`getMapSection`) leem este arquivo e todos os de `docs/mapa/`.

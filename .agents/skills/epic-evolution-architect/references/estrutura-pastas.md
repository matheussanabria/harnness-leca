# Estrutura Canônica de um Programa de Evolução

```text
docs/<nome-programa>/
├── 00-index.md                    # Índice mestre, progresso aceito e grafo Mermaid
├── 01-architecture/               # Diagnóstico de arquitetura e mapa de dependências
│   ├── current-state.md           # Auditoria do estado atual
│   ├── dependency-map.md          # Mapa de dependências entre frentes
│   └── target-architecture.md     # Arquitetura-alvo com contratos
├── 02-epics/                      # Diretório de Épicos
│   ├── EP-00-auditoria/           # Pasta do épico
│   │   ├── README.md              # Contexto, objetivos e lista de entregas do épico
│   │   ├── 00.01-slug.md          # História individual com contrato padronizado
│   │   └── 00.02-slug.md
│   └── EP-01-modulo/
├── 03-decisions/                  # Architecture Decision Records (ADRs)
│   ├── README.md                  # Índice de ADRs
│   └── ADR-001-titulo.md          # Contexto, decisão, alternativas e consequências
├── 04-test-plans/                 # Planos de Teste (TP)
│   ├── README.md                  # Estratégia de testes
│   └── TP-00-baseline.md          # Testes de regressão, unitários e E2E
├── 05-progress/                   # Governança de Progresso
│   ├── progress.md                # Tabela canônica de entregas aceitas com evidências
│   └── multi-agent-sync.md        # Mapa de frentes e ownership de arquivos
└── _templates/                    # Templates oficiais
    ├── story-template.md          # Template da história individual
    └── adr-template.md            # Template de ADR
```

## Regras de Links e Rastreabilidade
1. Todos os links dentro dos documentos de documentação devem ser **relativos** (ex: `[00.01](02-epics/EP-00-auditoria/00.01-inventario.md)`).
2. O índice mestre (`00-index.md`) consolida os contadores de entregas aceitas (ex: `72/104`).
3. Uma história só pode ser marcada como concluída `[x]` quando a seção 10 (Evidências) estiver preenchida com comandos e resultados verificados.

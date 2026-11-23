---
tags: [harness-evolution, adr]
---

# Decisões arquiteturais

Uma decisão vira ADR quando afeta mais de uma história ou é difícil de reverter. Use o [modelo](../_templates/adr-template.md) e nomeie como `ADR-NNN-titulo-curto.md`.

| ID | Título | Status | Histórias |
|---|---|---|---|
| ADR-001 | Onde fica o estado das janelas | a abrir no EP-00 | 01.01 |
| ADR-002 | Formato e versão do layout persistido | a abrir | 01.08, 01.10 |
| ADR-003 | Foco entre DOM e canvas da cena | a abrir | 01.03 |
| [ADR-004](ADR-004-registro-canonico-sessoes.md) | Registro canônico de sessões independente dos motores | proposta | 09.01, 09.03, 09.04 |
| [ADR-005](ADR-005-eventos-persistentes-sqlite.md) | Event store local persistente com SQLite nativo | proposta | 09.01, 09.02, 09.05 |
| [ADR-006](ADR-006-estados-ortogonais.md) | Separar execução, workflow e atenção | proposta | 09.02, 09.03, 09.05 |
| [ADR-007](ADR-007-ledger-coordenacao-agentes.md) | Ledger local para coordenação entre provedores | aceita | transversal |
| [ADR-008](ADR-008-consulta-jira-sem-token.md) | Consulta ao Jira por script local, com redação de dados pessoais | proposta | 05.07 |
| [ADR-009](ADR-009-memoria-um-fato-por-arquivo.md) | Memória curada com um fato por arquivo e índice gerado | aceita | EP-13 |
| [ADR-011](ADR-011-frontend-react-typescript-vite.md) | Incremental frontend migration to React 19, TypeScript and Vite | aceita | 16.00 to 16.05 |
| [ADR-012](ADR-012-sqlite-sistema-de-registro.md) | SQLite as the system of record for application state | proposta | EP-17 |
| [ADR-013](ADR-013-identidade-rbac-auditoria.md) | Local identity, RBAC and a tamper-evident audit trail | proposta | 17.04 to 17.06, 17.10 |
| [ADR-016](ADR-016-harness-gates-prototype-code-fidelity.md) | harness-gates: prototype x code fidelity gates owned by the Harness, runnable without it | proposta | transversal |
| [ADR-017](ADR-017-project-config-pointer-not-copy.md) | Project configuration: the harness points at the project repo, never copies product artifacts | aceita | transversal |
| [ADR-018](ADR-018-motion-timeline-format.md) | Motion design: declarative motion@1 timeline on Atelier screens, WAAPI runtime, export without ffmpeg | proposta | EP-24 |
| [ADR-019](ADR-019-escopos-e-posse-de-artefatos.md) | Feature scopes, explicit context and artifact ownership | proposta | EP-25 |
| [ADR-020](ADR-020-distribuicao-aberta-e-empacotamento.md) | Open self-hosted distribution, bring-your-own-keys and packaging order | proposta | 25.08, 25.09 |

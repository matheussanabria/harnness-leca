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

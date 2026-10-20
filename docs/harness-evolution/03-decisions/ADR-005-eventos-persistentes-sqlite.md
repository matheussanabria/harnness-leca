---
id: ADR-005
titulo: Event store local persistente com SQLite nativo
status: proposta
data: 2026-10-19
historias: [09.01, 09.02, 09.05]
tags: [harness-evolution, adr, eventos, sqlite]
---

# ADR-005: Event store local persistente com SQLite nativo

## Contexto

O Event Engine atual guarda histórico e projeções em `Map` e arrays. Reinício perde estado, deduplicação por ID pode descartar atualizações e o SSE não possui cursor durável. O produto é local, sem dependências de produção, e já usa `node:sqlite` para ler o OpenCode.

## Decisão proposta

Persistir eventos canônicos, sessões, projeções e itens de atenção em banco SQLite local versionado. Eventos entram por transação append-only; projetores atualizam read models idempotentes. O SSE publica sequências persistidas e recuperáveis.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| Memória com snapshot eventual | Pouco código e baixa latência | Janela de perda, recuperação complexa e consultas limitadas |
| JSONL append-only | Transparente e simples | Índices, compactação e transações mais difíceis |
| SQLite nativo | Transacional, indexável, local e sem pacote npm | Migrações e disciplina de acesso ao arquivo |
| Banco ou broker externo | Escala e ferramentas maduras | Infraestrutura desproporcional e quebra do modo autocontido |

## Justificativa

SQLite atende durabilidade, consulta e idempotência sem mudar o perfil operacional do Harness. A escala é local e não justifica infraestrutura distribuída.

## Consequências

Positivas:

- recuperação após reinício;
- filtros e paginação eficientes;
- cursor SSE persistente;
- trilha de auditoria para aprovação e workflow.

Trade-offs:

- schema e migrações precisam de testes;
- acesso concorrente deve ter transações curtas;
- retenção e compactação precisam de política explícita.

## Revisão

Revisar se o Harness evoluir para múltiplos servidores gravando simultaneamente ou exigir sincronização remota multiusuário.

---
id: ADR-009
titulo: Memória curada com um fato por arquivo e índice gerado
status: aceito
data: 2026-10-22
epico: EP-13
tags: [harness-evolution, adr, memoria]
---

# ADR-009: Memória curada com um fato por arquivo e índice gerado

## Contexto

A memória curada vive em bullets dentro de `memory.md`, injetados inteiros a cada mensagem. O export para os motores mistura memória curada com sugestões não revisadas e histórico bruto, e sobrescreve a pasta de memória do Claude Code. Diagnóstico completo em [EP-13/00-diagnostico](../02-epics/EP-13-memoria-agentes/00-diagnostico.md).

## Decisão

1. A memória curada passa a ter um arquivo por fato, com frontmatter (`name`, `description`, `type`, `created`, `updated`, `source`, `hash`).
2. `memory.md` vira índice gerado por script, com teto de 150 linhas, e mantém o nome para não quebrar o hook e o `AGENTS.md`.
3. Três camadas separadas: fonte bruta, oficina (candidatos) e vitrine (curada). Só a vitrine é projetada para os motores.
4. O harness é a fonte da verdade. Cada motor recebe uma projeção. Em pastas que pertencem ao motor, o harness só escreve dentro de um bloco marcado e colhe o resto para a oficina.
5. Deduplicação e recusa de segredos acontecem na escrita, por script, sem modelo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter bullets e só deduplicar | Não resolve carregamento sob demanda nem guarda o porquê e a origem. |
| Um arquivo global ao estilo `GEMINI.md` | Cresce sem limite, mistura projetos e entra inteiro no contexto. |
| Banco SQLite para memória | Perde a legibilidade e o diff no git, que hoje são o meio de revisão do usuário. |
| Extração automática direto para a memória | Contraria a regra da base: nada vai para a memória sem revisão. |
| Busca por embeddings | Exige modelo e runtime; similaridade por trigramas basta para o volume atual (dezenas de itens por projeto). |

## Consequências

- Positivas: menos tokens por mensagem, nenhum dado perdido no export, origem rastreável, faxina automatizável.
- Negativas: mais arquivos no repositório; agentes precisam usar `tools/memory.js save` em vez de editar `memory.md` direto, o que exige ajustar `CLAUDE.md` e `AGENTS.md` (com pedido do usuário, pois são instruções).
- Rollback: `HARNESS_MEMORY_FORMAT=legacy` e `memory.legacy.md` até o aceite do EP-13.

---
id: EP-21-modelos
titulo: "EP-21: avaliação dos modelos de IA para gerar diagramas"
status: proposta (nada medido ainda)
---

# Modelos de IA para diagramas

[Voltar ao EP-21](README.md)

## O que se pede do modelo

| Tarefa | Saída | Exigência principal |
|---|---|---|
| Mermaid (flowchart, sequência, classes, estado, ER, gantt) | Bloco `<diagram>` com texto | Sintaxe válida; Mermaid é sensível a aspas, parênteses e palavras reservadas em rótulos |
| Flow | Bloco `<flow>` com JSON | Aderência a schema, ids únicos, arestas que apontam para nós existentes |
| Editar diagrama existente | Bloco novo em modo `replace` ou `append` | Preservar o que não foi pedido para mudar |
| Imagem ou captura para diagrama | Mermaid ou JSON | Visão; hoje só o primeiro modelo do `harness-diagramas` é marcado como VL |
| Decompor o pedido (planejar) | Texto | Raciocínio; não é geração de diagrama |

## Situação atual (combos do 9Router, lidos em 2026-11-06)

- `harness-diagramas`: `openrouter/nemotron-3.5-super-vl`, depois `oc/glm-5.3-flash-free`, depois `ag/claude-sonnet-5-5-medium`.
- `harness-design`: glm-5.3-flash-free, deepseek-v4.1-flash-free, nvidia minimax-m3.1-flash, gemini-4-argon-low, sonnet-5-5-medium, `cc/claude-sonnet-5-5`.
- `harness-planejamento`: nemotron-3.5-super-vl, `ag/claude-opus-5-5-medium`, `cc/claude-opus-5-5`.
- Regras já registradas: grátis primeiro, premium só como cauda; não usar Smart Router; resposta curta sem tabela em revisão multiarquivo é falha (`combo-delegation-quality`).

Não há dado medido de qualidade de diagrama por modelo. Tudo abaixo é hipótese a confirmar na sonda.

## Recomendação (hipótese, a validar)

Estratégia em camadas, com validador determinístico em vez de confiar no modelo:

1. **Geração**: combo grátis primeiro (GLM flash, depois nemotron). Diagramas pequenos e médios costumam ser fáceis para modelos desse porte.
2. **Validação automática**: `mermaid.parse` para Mermaid; schema + checagens de grafo para Flow.
3. **Reparo**: se inválido, devolver o erro exato ao mesmo modelo, uma tentativa. Isso costuma custar menos que subir de modelo.
4. **Escalada**: persistindo a falha, Sonnet 5.5 (já é a cauda do `harness-diagramas`).
5. **Opus 5.5**: não para gerar diagramas. Reservar ao planejamento e decomposição, onde já está.
6. **Imagem para diagrama**: manter o modelo com visão na frente desse caminho; testar à parte.

Tamanho pesa: ER e classes grandes, gantt com datas e Flow com muitos nós tendem a derrubar modelos pequenos. A sonda deve ter cenários pequeno, médio e grande por tipo.

## Como medir (história 21.05)

Estender `tools/canvas-chat-probe.js` e `tools/lib/canvas-probe/`:

- **Cenários novos**: um por tipo Mermaid (6), três de Flow (linear, ramificado com ciclo proibido, grande), edição com `append`, pedido ambíguo, tipo não suportado, e pedido em português com acentos nos rótulos.
- **Juiz determinístico** (novos códigos): `PARSE_ERROR`, `SCHEMA_INVALID`, `DANGLING_EDGE`, `CYCLE`, `LOST_CONTENT` (edição apagou nós), `LABEL_TRUNCATED`.
- **Métricas por modelo e tipo**: taxa de aprovação na primeira tentativa, taxa após um reparo, latência, tokens (via contabilidade do 9Router), repetições `--repeat 3` para medir variância.
- **Candidatos**: GLM 5.3 flash, DeepSeek v4.1 flash, nemotron 3.5 super VL, MiniMax M3.1 flash (nvidia), Gemini 4 argon low, Sonnet 5.5 como referência.
- **Decisão**: o modelo mais barato que passe de um limiar definido antes da execução (proposta: 90% após reparo nos cenários pequenos e médios, 70% nos grandes) entra na frente do combo; o resto vira escalada. Resultado grava em `context/` e vira memória `reference`.

## Restrições de execução

- Modelos grátis (opencode, combos grátis do 9Router) rodam sem aprovação extra.
- Rodar Sonnet 5.5 ou qualquer motor `claude` na sonda gasta cota: só com pedido explícito, e a sonda exige `--allow-claude` / `--allow-paid`.
- Se um combo devolver resposta curta e sem bloco, contar como falha do cenário, não repetir sem limite.

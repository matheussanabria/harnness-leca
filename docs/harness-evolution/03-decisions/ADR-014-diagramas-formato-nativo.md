# ADR-014: Diagramas estruturados guardam o formato nativo de cada editor

- Status: proposta (EP-21, história 21.01)
- Data: 2026-11-06
- Relacionados: ADR-011 (ilhas React), EP-19 (Canvas), EP-15 (runtime de agentes)

## Contexto
O Canvas tem dois kinds: `board` (Excalidraw) e `mindmap`. O servidor guarda `data` opaco (4 MB) com `rev` e migrações. O EP-21 acrescenta diagramas como código (Mermaid) e fluxos estruturados (React Flow). Os três modelos de dados são diferentes; converter entre eles perde informação (o 19.09 já mostra isso: Mermaid vira desenho Excalidraw e não volta).

## Decisão
1. **Um kind por formato nativo.** Novos kinds `diagram` (Mermaid) e `flow` (React Flow). `data.schema` versionado: `mermaid@1`, `flow@1`.
2. **Conversão só explícita.** Converter cria um board novo e mantém o original; nunca reescreve o formato de origem. Conversões suportadas são listadas uma a uma (hoje: Mermaid flowchart/sequence/class para Excalidraw).
3. **`mermaid@1`**: `{ schema, source, diagramType, theme? }`. `source` é a verdade; o SVG é derivado e não é salvo. Limite de 64 KB de texto.
4. **`flow@1`** separa semântica de layout: `graph: { nodes: [{id, type, label, params}], edges: [{id, from, to, fromPort?, toPort?, label?}] }`, `layout: { positions: {id: {x, y}}, viewport }`, `purpose: "doc" | "executable"`. Um executor futuro lê só `graph`.
5. **Vínculos** em `links: [{ type: "story" | "epic" | "agent" | "project", id }]` na raiz do board (fora de `data`), válidos para todos os kinds; máximo 20.
6. **Segurança do Mermaid**: `securityLevel: "strict"`, `htmlLabels: false`, sem `click`/callbacks; o SVG renderizado passa por sanitização antes de entrar no DOM.
7. **Bibliotecas** entram sob demanda (`React.lazy`/`import()`), fixadas em versão exata, como o Excalidraw.

## Consequências
- Cada kind tem ilha, ponte de chat e juiz próprios; nenhum código compartilha modelo de dados entre kinds.
- `canvas-validate.js` passa a ter um registro de kinds; `canvas-migrate.js` sobe para a versão 2 só se `links` exigir migração (campo opcional não exige).
- UML, ER, estado e gantt ficam em Mermaid; editores visuais dedicados só com demanda medida.

## Decidido
- **Uma aba "Diagramas" no Design** (usuário, 2026-11-06). A view `canvas-diagram` lista no catálogo lateral os boards dos kinds `diagram` e `flow` juntos, com ícone por tipo; "Novo" escolhe o tipo (um modelo Mermaid ou Flow); a ilha montada segue o kind do board selecionado, e o contexto do chat também. Nenhuma aba nova para Flow.

## Questões em aberto
- `mermaid.parse` sob Node puro (para a sonda) precisa de DOM? Resolver no 21.03; plano B é julgar no navegador com `playwright-core`.

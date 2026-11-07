# ADR-014: Diagramas estruturados guardam o formato nativo de cada editor

- Status: aceita (EP-21, história 21.01)
- Data: 2026-11-06 (spike e aceite em 2026-11-07)
- Relacionados: ADR-011 (ilhas React), EP-19 (Canvas), EP-15 (runtime de agentes)

## Contexto
O Canvas tem dois kinds: `board` (Excalidraw) e `mindmap`. O servidor guarda `data` opaco (4 MB) com `rev` e migrações. O EP-21 acrescenta diagramas como código (Mermaid) e fluxos estruturados (React Flow). Os três modelos de dados são diferentes; converter entre eles perde informação (o 19.09 já mostra isso: Mermaid vira desenho Excalidraw e não volta).

## Decisão
1. **Um kind por formato nativo.** Novos kinds `diagram` (Mermaid) e `flow` (React Flow). `data.schema` versionado: `mermaid@1`, `flow@1`.
2. **Conversão só explícita.** Converter cria um board novo e mantém o original; nunca reescreve o formato de origem. Conversões suportadas são listadas uma a uma (hoje: Mermaid flowchart/sequence/class para Excalidraw).
3. **`mermaid@1`**: `{ schema, source, diagramType, theme? }`. `source` é a verdade; o SVG é derivado e não é salvo. Limite de 64 KB de texto.
4. **`flow@1`** separa semântica de layout. Um executor futuro lê só `graph`.
5. **Vínculos** em `links: [{ type: "story" | "epic" | "agent" | "project", id }]` na raiz do board (fora de `data`), válidos para todos os kinds; máximo 20.
6. **Segurança do Mermaid**: `securityLevel: "strict"`, `htmlLabels: false`, sem `click`/callbacks; o SVG renderizado passa por sanitização antes de entrar no DOM.
7. **Bibliotecas** entram sob demanda (`React.lazy`/`import()`), fixadas em versão exata, como o Excalidraw.
8. **Pacote `mermaid` fixado em 11.17.2**, a mesma versão que o repositório já resolve como dependência indireta de `@excalidraw/mermaid-to-excalidraw`; uma versão diferente (a 12.3.0 é a mais recente) duplicaria o pacote no bundle. Subir de versão é uma decisão separada, para os dois pacotes juntos.
9. **Tipos aceitos** são os que `mermaid.parse` devolve em `diagramType`, filtrados por lista própria: `flowchart-v2`, `sequence`, `classDiagram`, `stateDiagram`, `er`, `gantt`. O `parse` aceita outros (ex.: `pie`), então o filtro é nosso e não do Mermaid.

## Exemplos
```json
{ "schema": "mermaid@1", "diagramType": "flowchart-v2",
  "source": "flowchart TD\n A[Início] --> B{Ok?}\n B -->|sim| C[Fim]" }
```
```json
{ "schema": "flow@1", "purpose": "doc",
  "graph": { "nodes": [ { "id": "n1", "type": "start", "label": "Início", "params": {} },
                        { "id": "n2", "type": "step", "label": "Analisar", "params": { "agent": "analista" } } ],
             "edges": [ { "id": "e1", "from": "n1", "to": "n2" } ] },
  "layout": { "positions": { "n1": { "x": 0, "y": 0 }, "n2": { "x": 220, "y": 0 } },
              "viewport": { "x": 0, "y": 0, "zoom": 1 } } }
```
Com `links` na raiz do board: `"links": [ { "type": "story", "id": "EP-21.04" } ]`.

## Resultado do spike: `mermaid.parse` em Node (2026-11-07)
Testado nas versões 11.17.2 e 12.3.0, Node 24, com 6 tipos válidos, um erro de sintaxe e um tipo fora da lista.
- **Sem DOM, não serve.** Só sequência e ER passam; flowchart, classes, estado e gantt falham com `DOMPurify.addHook is not a function`.
- **Com `jsdom` 31 (window e document globais antes do `import("mermaid")`), tudo passa**, em 20 a 68 ms por diagrama, igual nas duas versões. O `import` precisa ser dinâmico e vir depois de definir o DOM.
- Erro de sintaxe vem como `Parse error on line 3: ...` com a linha; serve para a mensagem de reparo ao modelo.
- Consequência: a sonda (21.06) julga em Node com `jsdom` como dependência de desenvolvimento (a escolher na 21.06, só onde a sonda a usar) e não precisa de Playwright. O plano B (navegador) fica descartado.
- Tamanho: `mermaid.min.js` 11.17.2 tem 3,5 MB (cerca de 1,5 MB comprimido), por isso o carregamento é lazy. O tamanho final do chunk do Vite é medido na 21.04, quando o pacote entrar no build.

## Consequências
- Cada kind tem ilha, ponte de chat e juiz próprios; nenhum código compartilha modelo de dados entre kinds.
- `canvas-validate.js` passa a ter um registro de kinds; `canvas-migrate.js` sobe para a versão 2 só se `links` exigir migração (campo opcional não exige).
- UML, ER, estado e gantt ficam em Mermaid; editores visuais dedicados só com demanda medida.
- `mermaid` passa a ser dependência direta de `package.json` (21.03), na versão exata 11.17.2.

## Decidido
- **Uma aba "Diagramas" no Design** (usuário, 2026-11-06). A view `canvas-diagram` lista no catálogo lateral os boards dos kinds `diagram` e `flow` juntos, com ícone por tipo; "Novo" escolhe o tipo (um modelo Mermaid ou Flow); a ilha montada segue o kind do board selecionado, e o contexto do chat também. Nenhuma aba nova para Flow.

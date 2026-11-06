// @ts-check
"use strict";
// Probe scenarios for the Canvas chat bridges (P-109). Each one is a user request plus the canvas state the island
// would publish, and what a well-behaved answer must look like.
/** @typedef {{ id: string, kind: "mindmap"|"board", request: string, state: object, expect: object, history?: { request: string, answer: string } }} Scenario */

const MAP = { boardId: "b1", title: "Plano do produto", selectedId: "n2", selectedText: "Backend", outline: "- Plano do produto\n  - Frontend\n  - Backend\n  - Infra" };
const EMPTY_MAP = { boardId: "b2", title: "Mapa vazio", selectedId: "r", selectedText: "Mapa vazio", outline: "- Mapa vazio" };
const BOARD = { boardId: "q1", title: "Quadro", selectedId: "", selectedText: "", outline: "Elementos: 3 formas, 2 setas/linhas, 0 imagens\n- Início\n- Validar\n- Fim" };
const EMPTY_BOARD = { boardId: "q2", title: "Quadro vazio", selectedId: "", selectedText: "", outline: "Elementos: 0 formas, 0 setas/linhas, 0 imagens" };

/** @type {Scenario[]} */
const SCENARIOS = [
  { id: "mm-new", kind: "mindmap", request: "Crie um mapa mental sobre lançamento de um aplicativo de delivery", state: EMPTY_MAP, expect: { mode: "new", minAdded: 6 } },
  { id: "mm-expand-selected", kind: "mindmap", request: "Expanda o nó Backend com 4 subtópicos", state: MAP, expect: { mode: "append", parent: "selected", minAdded: 4 } },
  { id: "mm-expand-root", kind: "mindmap", request: "Adicione um novo ramo de Segurança na raiz com 3 itens", state: MAP, expect: { mode: "append", parent: "root", minAdded: 4 } },
  { id: "mm-replace", kind: "mindmap", request: "Refaça o mapa inteiro como um plano de estudos de inglês em 3 meses", state: MAP, expect: { mode: "new", minAdded: 6 } },
  { id: "mm-deep", kind: "mindmap", request: "Detalhe Infra com o máximo de níveis que puder sobre CI/CD e observabilidade", state: MAP, expect: { mode: ["append", "new"], minAdded: 6 } },
  { id: "mm-chat-only", kind: "mindmap", request: "Qual a diferença entre mapa mental e fluxograma? Responda só conversando.", state: MAP, expect: { noBlock: true } },
  { id: "mm-resumed", kind: "mindmap", request: "Agora adicione também Testes sob o nó selecionado", state: MAP, expect: { mode: "append", minAdded: 1 },
    history: { request: "Expanda o nó Backend com 2 subtópicos", answer: "Adicionei dois subtópicos.\n<mindmap parent=\"selected\">\n- API\n- Banco de dados\n</mindmap>" } },
  { id: "bd-flow", kind: "board", request: "Desenhe um fluxograma de login com validação de senha e bloqueio após 3 tentativas", state: EMPTY_BOARD, expect: { mode: ["replace", "append"], headers: ["flowchart", "graph"] } },
  { id: "bd-sequence", kind: "board", request: "Acrescente um diagrama de sequência de checkout entre cliente, API e gateway de pagamento", state: BOARD, expect: { mode: "append", headers: ["sequencediagram"] } },
  { id: "bd-class", kind: "board", request: "Acrescente um diagrama de classes com Pedido, Item e Cliente", state: BOARD, expect: { mode: "append", headers: ["classdiagram"] } },
  { id: "bd-unsupported", kind: "board", request: "Faça um gráfico de pizza com a divisão do orçamento: 50% dev, 30% infra, 20% marketing", state: BOARD, expect: { mode: ["replace", "append"], headers: ["flowchart", "graph", "sequencediagram", "classdiagram"], allowNoBlock: true } },
  { id: "bd-chat-only", kind: "board", request: "Quando devo usar um diagrama de sequência? Só explique, sem desenhar.", state: BOARD, expect: { noBlock: true } },
  { id: "bd-resumed", kind: "board", request: "Agora acrescente o caminho de erro quando o pagamento falha", state: BOARD, expect: { mode: "append", headers: ["flowchart", "graph", "sequencediagram"] },
    history: { request: "Desenhe o fluxo de pagamento aprovado", answer: "Aqui está o fluxo.\n<board mode=\"append\">\nflowchart TD\n  A[Pedido] --> B[Pagar] --> C[Aprovado]\n</board>" } },
];

module.exports = { SCENARIOS };

// @ts-check
// Starter documents of the "new diagram" menu in the Design catalog (EP-21.04). Plain JS because the legacy shell has
// no bundler; ui/web/src/features/diagram/templates.ts holds the same six templates and tests/diagram-editor-wiring.test.js
// checks that the two lists never drift apart.

/** @type {ReadonlyArray<{ key: string, diagramType: string, label: string, icon: string, title: string, source: string }>} */
export const DIAGRAM_TEMPLATES = [
  { key: "flowchart", diagramType: "flowchart-v2", label: "Fluxograma", icon: "fa-diagram-project", title: "Novo fluxograma",
    source: "flowchart TD\n  A[Início] --> B{Pedido válido?}\n  B -->|sim| C[Separar estoque]\n  B -->|não| D[Pedir correção]\n  C --> E[Enviar]\n  D --> B\n" },
  { key: "sequence", diagramType: "sequence", label: "Sequência", icon: "fa-arrows-left-right", title: "Nova sequência",
    source: "sequenceDiagram\n  Cliente->>Loja: Faz o pedido\n  Loja->>Estoque: Reserva itens\n  Estoque-->>Loja: Confirmado\n  Loja-->>Cliente: Pedido aceito\n" },
  { key: "class", diagramType: "classDiagram", label: "Classes", icon: "fa-cubes", title: "Novo diagrama de classes",
    source: 'classDiagram\n  class Pedido {\n    +int id\n    +total() float\n  }\n  Pedido "1" --> "*" Item\n' },
  { key: "state", diagramType: "stateDiagram", label: "Estados", icon: "fa-circle-nodes", title: "Novo diagrama de estados",
    source: "stateDiagram-v2\n  [*] --> Aberto\n  Aberto --> Pago\n  Pago --> Enviado\n  Enviado --> [*]\n" },
  { key: "er", diagramType: "er", label: "Entidade-relacionamento", icon: "fa-table", title: "Novo modelo de dados",
    source: 'erDiagram\n  CLIENTE ||--o{ PEDIDO : faz\n  PEDIDO ||--|{ ITEM : "contém"\n' },
  { key: "gantt", diagramType: "gantt", label: "Gantt", icon: "fa-chart-gantt", title: "Novo cronograma",
    source: "gantt\n  title Entrega\n  dateFormat YYYY-MM-DD\n  section Loja\n  Separar :a1, 2025-01-01, 2d\n  Enviar :after a1, 3d\n" },
];

/** @param {string} [key] template key; the flowchart when missing or unknown */
export function findDiagramTemplate(key) {
  return DIAGRAM_TEMPLATES.find((template) => template.key === key) || DIAGRAM_TEMPLATES[0];
}

/** Board payload (mermaid@1) of a template. @param {{ diagramType: string, source: string }} template */
export function diagramStarter(template) {
  return { schema: "mermaid@1", diagramType: template.diagramType, source: template.source };
}

/** Menu markup: one button per template. */
export function diagramTemplateMenuHtml() {
  const items = DIAGRAM_TEMPLATES.map((t) =>
    `<button type="button" role="menuitem" class="canvas-template-btn" data-canvas-template="${t.key}"><i class="fa-solid ${t.icon}"></i> ${t.label}</button>`).join("");
  return `<div class="canvas-template-menu" role="menu" aria-label="Tipo do novo diagrama">${items}</div>`;
}

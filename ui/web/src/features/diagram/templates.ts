// Starter documents for the "new diagram" menu (EP-21.04). Pure data: one template per supported type.
// Labels with accents are quoted where Mermaid needs it (the ER relationship label is the usual trap).
import { createDiagramData } from "./data.ts";
import type { DiagramData, DiagramType } from "./types.ts";

export interface DiagramTemplate {
  key: string;
  type: DiagramType;
  label: string;
  icon: string;
  title: string;
  source: string;
}

export const TEMPLATES: readonly DiagramTemplate[] = [
  {
    key: "flowchart",
    type: "flowchart-v2",
    label: "Fluxograma",
    icon: "fa-diagram-project",
    title: "Novo fluxograma",
    source:
      "flowchart TD\n  A[Início] --> B{Pedido válido?}\n  B -->|sim| C[Separar estoque]\n  B -->|não| D[Pedir correção]\n  C --> E[Enviar]\n  D --> B\n",
  },
  {
    key: "sequence",
    type: "sequence",
    label: "Sequência",
    icon: "fa-arrows-left-right",
    title: "Nova sequência",
    source:
      "sequenceDiagram\n  Cliente->>Loja: Faz o pedido\n  Loja->>Estoque: Reserva itens\n  Estoque-->>Loja: Confirmado\n  Loja-->>Cliente: Pedido aceito\n",
  },
  {
    key: "class",
    type: "classDiagram",
    label: "Classes",
    icon: "fa-cubes",
    title: "Novo diagrama de classes",
    source: 'classDiagram\n  class Pedido {\n    +int id\n    +total() float\n  }\n  Pedido "1" --> "*" Item\n',
  },
  {
    key: "state",
    type: "stateDiagram",
    label: "Estados",
    icon: "fa-circle-nodes",
    title: "Novo diagrama de estados",
    source: "stateDiagram-v2\n  [*] --> Aberto\n  Aberto --> Pago\n  Pago --> Enviado\n  Enviado --> [*]\n",
  },
  {
    key: "er",
    type: "er",
    label: "Entidade-relacionamento",
    icon: "fa-table",
    title: "Novo modelo de dados",
    source: 'erDiagram\n  CLIENTE ||--o{ PEDIDO : faz\n  PEDIDO ||--|{ ITEM : "contém"\n',
  },
  {
    key: "gantt",
    type: "gantt",
    label: "Gantt",
    icon: "fa-chart-gantt",
    title: "Novo cronograma",
    source:
      "gantt\n  title Entrega\n  dateFormat YYYY-MM-DD\n  section Loja\n  Separar :a1, 2025-01-01, 2d\n  Enviar :after a1, 3d\n",
  },
];

export function findTemplate(key: string): DiagramTemplate | undefined {
  return TEMPLATES.find((template) => template.key === key);
}

/** Board payload for a new diagram of the given template. */
export function templateData(template: DiagramTemplate): DiagramData {
  return createDiagramData(template.source, template.type);
}

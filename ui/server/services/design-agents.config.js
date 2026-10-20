// @ts-check

/**
 * Mapeamento das etapas do fluxo de design para agentes reais do DAI (.agents/)
 * e a próxima ação sugerida segundo a metodologia de trabalho.
 */
const DESIGN_STAGE_AGENTS = {
  prototype: {
    agentId: "ux-ui-designer",
    agentName: "UX/UI Designer",
    icon: "🎨",
    nextStage: "extracted",
    nextAction: "Decompor protótipo visual e isolar elementos reutilizáveis como componentes.",
  },
  extracted: {
    agentId: "ux-ui-designer",
    agentName: "UX/UI Designer",
    icon: "📐",
    nextStage: "design_system",
    nextAction: "Definir interface, props, estados e tokens do componente para o Design System.",
  },
  design_system: {
    agentId: "frontend-engineer",
    agentName: "Frontend Engineer",
    icon: "🧱",
    nextStage: "boilerplate",
    nextAction: "Desenvolver esqueleto de código (boilerplate) e empacotar no catálogo do Design System.",
  },
  boilerplate: {
    agentId: "frontend-engineer",
    agentName: "Frontend Engineer",
    icon: "⚡",
    nextStage: "implemented",
    nextAction: "Integrar o componente na aplicação consumindo via MCP do Design System.",
  },
  implemented: {
    agentId: "documentation-engineer",
    agentName: "Documentation Engineer",
    icon: "📝",
    nextStage: "documented",
    nextAction: "Documentar e mapear a funcionalidade nas 4 camadas (UI/UX, Regras, API, Dados).",
  },
  documented: {
    agentId: "qa-engineer",
    agentName: "QA Engineer",
    icon: "✅",
    nextStage: "completed",
    nextAction: "Componente e feature totalmente integrados e documentados no dossiê.",
  },
};

const STAGE_ORDER = [
  "prototype",
  "extracted",
  "design_system",
  "boilerplate",
  "implemented",
  "documented",
];

const STAGE_LABELS = {
  prototype: "Protótipo",
  extracted: "Extraído",
  design_system: "No design system",
  boilerplate: "Boilerplate",
  implemented: "Implementado",
  documented: "Documentado",
};

module.exports = {
  DESIGN_STAGE_AGENTS,
  STAGE_ORDER,
  STAGE_LABELS,
};

// @ts-check
const { DESIGN_STAGE_AGENTS, STAGE_ORDER, STAGE_LABELS } = require("./design-agents.config");

/**
 * Calcula a lista de checagem (6 marcas) de um componente com inferência retroativa.
 * Se uma etapa posterior foi atingida, as anteriores são inferidas automaticamente.
 * @param {object} comp - Dados do componente
 * @param {object} context - Contexto com dados de verificação do app/repo
 */
function calculateChecklist(comp, context = {}) {
  const compId = (comp.id || "").toLowerCase();
  const compName = (comp.name || "").toLowerCase();
  const compSelector = (comp.selector || "").toLowerCase();

  // Verificações diretas
  const verifiedInPrototype = Boolean(
    comp.inPrototype ||
    (context.prototypeComponents && (
      context.prototypeComponents.has(compId) ||
      context.prototypeComponents.has(compName) ||
      context.prototypeComponents.has(compSelector)
    ))
  );

  const verifiedExtracted = Boolean(
    comp.isExtracted ||
    verifiedInPrototype ||
    comp.dsFolder ||
    comp.selector ||
    (context.extractedComponents && (
      context.extractedComponents.has(compId) ||
      context.extractedComponents.has(compName) ||
      context.extractedComponents.has(compSelector)
    ))
  );

  const verifiedInDS = Boolean(
    comp.inDesignSystem ||
    comp.dsFolder ||
    (context.dsComponents && (
      context.dsComponents.has(compId) ||
      context.dsComponents.has(compName) ||
      context.dsComponents.has(compSelector)
    ))
  );

  const verifiedBoilerplate = Boolean(
    comp.hasBoilerplate ||
    (context.boilerplateComponents && (
      context.boilerplateComponents.has(compId) ||
      context.boilerplateComponents.has(compName) ||
      context.boilerplateComponents.has(compSelector)
    ))
  );

  const verifiedImplemented = Boolean(
    comp.isImplemented ||
    (context.implementedComponents && (
      context.implementedComponents.has(compId) ||
      context.implementedComponents.has(compName) ||
      context.implementedComponents.has(compSelector)
    ))
  );

  const verifiedDocumented = Boolean(
    comp.isDocumented ||
    (context.documentedComponents && (
      context.documentedComponents.has(compId) ||
      context.documentedComponents.has(compName) ||
      context.documentedComponents.has(compSelector)
    ))
  );

  // Regra de Inferência: etapa posterior satisfeita implica as anteriores
  let highestVerified = "";
  if (verifiedDocumented) highestVerified = "Documentado";
  else if (verifiedImplemented) highestVerified = "Implementado";
  else if (verifiedBoilerplate) highestVerified = "Boilerplate";
  else if (verifiedInDS) highestVerified = "No design system";
  else if (verifiedExtracted) highestVerified = "Extraído";

  const inPrototype = verifiedInPrototype || Boolean(highestVerified);
  const isExtracted = verifiedExtracted || verifiedInDS || verifiedBoilerplate || verifiedImplemented || verifiedDocumented;
  const inDesignSystem = verifiedInDS || verifiedBoilerplate;
  const hasBoilerplate = verifiedBoilerplate;
  const isImplemented = verifiedImplemented;
  const isDocumented = verifiedDocumented;

  return {
    inPrototype,
    isExtracted,
    inDesignSystem,
    hasBoilerplate,
    isImplemented,
    isDocumented,
    meta: {
      inPrototype: { checked: inPrototype, inferred: !verifiedInPrototype && inPrototype, inferredFrom: highestVerified },
      isExtracted: { checked: isExtracted, inferred: !verifiedExtracted && isExtracted, inferredFrom: highestVerified },
      inDesignSystem: { checked: inDesignSystem, inferred: !verifiedInDS && inDesignSystem, inferredFrom: verifiedBoilerplate ? "Boilerplate" : null },
      hasBoilerplate: { checked: hasBoilerplate, inferred: false, inferredFrom: null },
      isImplemented: { checked: isImplemented, inferred: false, inferredFrom: null },
      isDocumented: { checked: isDocumented, inferred: false, inferredFrom: null },
    },
  };
}

/**
 * Determina a coluna Kanban do componente baseando-se na MAIOR ETAPA SATISFEITA,
 * a menos que haja um stageOverride explícito no design.json.
 * @param {any} checklist
 * @param {string|null} [stageOverride]
 * @returns {{ stage: string, isOverridden: boolean }}
 */
function determineStage(checklist, stageOverride) {
  if (stageOverride && STAGE_ORDER.includes(stageOverride)) {
    return { stage: stageOverride, isOverridden: true };
  }

  // A coluna é a maior etapa satisfeita
  if (checklist.isDocumented) return { stage: "documented", isOverridden: false };
  if (checklist.isImplemented) return { stage: "implemented", isOverridden: false };
  if (checklist.hasBoilerplate) return { stage: "boilerplate", isOverridden: false };
  if (checklist.inDesignSystem) return { stage: "design_system", isOverridden: false };
  if (checklist.isExtracted) return { stage: "extracted", isOverridden: false };
  if (checklist.inPrototype) return { stage: "prototype", isOverridden: false };

  return { stage: "prototype", isOverridden: false };
}

/**
 * Enriquece um componente com o checklist, coluna Kanban calculada e agente DAI.
 * @param {object} comp
 * @param {object} context
 */
function enrichComponentStage(comp, context = {}) {
  const checklist = calculateChecklist(comp, context);
  const { stage, isOverridden } = determineStage(checklist, comp.stageOverride || null);
  const dai = DESIGN_STAGE_AGENTS[stage] || DESIGN_STAGE_AGENTS.prototype;

  return {
    ...comp,
    stage,
    stageLabel: STAGE_LABELS[stage] || stage,
    isOverridden,
    checklist,
    dai: {
      agentId: dai.agentId,
      agentName: dai.agentName,
      icon: dai.icon,
      nextStage: dai.nextStage,
      nextStageLabel: STAGE_LABELS[dai.nextStage] || dai.nextStage,
      nextAction: dai.nextAction,
    },
  };
}

module.exports = {
  calculateChecklist,
  determineStage,
  enrichComponentStage,
};

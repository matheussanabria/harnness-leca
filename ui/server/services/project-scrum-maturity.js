// @ts-check
// Maturidade da historia (draft -> refining -> ready). Historia sem o campo vale "ready": nada muda para o legado e o Jira.
const { evaluateDor } = require("./project-scrum-dor");

const MATURITY_VALUES = ["draft", "refining", "ready"];
const DEFAULT_MATURITY = "ready";

/** @param {unknown} value @returns {string|undefined} undefined quando o campo nao foi enviado */
function normalizeMaturity(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const maturity = String(value).trim().toLowerCase();
  if (!MATURITY_VALUES.includes(maturity)) {
    throw new Error(`Maturidade '${value}' invalida. Use: ${MATURITY_VALUES.join(", ")}.`);
  }
  return maturity;
}

/** @param {any} story */
function maturityOf(story) {
  return story && MATURITY_VALUES.includes(story.maturity) ? story.maturity : DEFAULT_MATURITY;
}

/** Aplica o padrao na leitura sem gravar. @param {any[]} stories */
function withMaturity(stories) {
  return stories.map((story) => (MATURITY_VALUES.includes(story.maturity) ? story : { ...story, maturity: DEFAULT_MATURITY }));
}

/** Rascunho e refinamento ficam no Product Backlog: so uma historia pronta entra na sprint. */
function assertCanEnterSprint(story, sprintId) {
  if (sprintId && maturityOf(story) !== "ready") {
    throw new Error("Historia em rascunho ou refinamento nao entra na sprint: marque como pronta (Definition of Ready) antes.");
  }
}

/**
 * Valida a mudanca de maturidade pedida em um upsert.
 * @param {any|undefined} existing historia ja gravada (undefined quando e nova)
 * @param {any} merged historia como ficara depois do upsert
 * @param {string|undefined} requested maturidade enviada no payload
 */
function assertMaturityChange(existing, merged, requested) {
  const current = existing ? maturityOf(existing) : undefined;
  // Maturidade que a historia tera depois do upsert: a pedida, ou a gravada, ou "ready" (historia nova sem o campo).
  const effective = requested ?? current ?? DEFAULT_MATURITY;
  if (requested === "ready" && current !== "ready") {
    const dor = evaluateDor(merged);
    if (!dor.ready) throw new Error(`Historia nao atende a Definition of Ready: ${dor.requiredFailed.join(", ")}.`);
  }
  if (effective !== "ready" && merged.sprintId) {
    // Mesmo sem pedir mudanca de maturidade: editar sprintId de um rascunho tambem nao pode empurra-lo para a sprint.
    throw new Error(current === "ready" && requested !== undefined
      ? "Retire a historia da sprint antes de voltar para rascunho ou refinamento."
      : "Historia em rascunho ou refinamento nao entra na sprint: marque como pronta (Definition of Ready) antes.");
  }
}

module.exports = { MATURITY_VALUES, DEFAULT_MATURITY, normalizeMaturity, maturityOf, withMaturity, assertCanEnterSprint, assertMaturityChange };

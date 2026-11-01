// @ts-check
// Componente de renderização do selo de atividade com ícone e texto (EP-09.06).
const { getActivityDisplay } = require("./engine-activity-model");

/**
 * Renderiza um badge HTML acessível com ícone FontAwesome e texto descritivo.
 * @param {{
 *   engineId: string,
 *   presenca: "online" | "offline",
 *   atividade: string,
 *   detalhe?: string,
 *   isStale?: boolean
 * }} params
 * @returns {string}
 */
function renderEngineActivityBadge(params) {
  const { engineId, presenca, atividade, detalhe, isStale } = params;
  const display = getActivityDisplay(atividade);

  const presencaClass = presenca === "online" ? "badge-online" : "badge-offline";
  const staleClass = isStale ? "badge-stale" : "";
  const titleText = detalhe ? `${display.label} (${detalhe})` : display.label;

  return `
<span class="engine-activity-badge ${presencaClass} ${display.classModifier} ${staleClass}" data-engine="${engineId}" title="${titleText}" aria-label="${engineId}: ${titleText}">
  <i class="${display.icon}" aria-hidden="true"></i>
  <span class="badge-label">${display.label}</span>
  ${isStale ? '<span class="badge-stale-tag">atrasado</span>' : ""}
</span>`.trim();
}

module.exports = {
  renderEngineActivityBadge,
};

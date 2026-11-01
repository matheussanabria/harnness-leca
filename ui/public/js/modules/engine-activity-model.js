// @ts-check
// Mapeamento e formato para exibição de presença e atividade de motores (EP-09.06).
// Proibição estrita de emojis: utiliza exclusivamente FontAwesome.

/**
 * @typedef {import("../../../tools/lib/engine-monitor/activity-machine").AtividadeEstado} AtividadeEstado
 */

/**
 * Tabela canônica de ícones FontAwesome e rótulos por estado de atividade.
 */
const ACTIVITY_DISPLAY_MAP = /** @type {Record<AtividadeEstado, { label: string, icon: string, classModifier: string }>} */ ({
  lendo: {
    label: "Lendo",
    icon: "fa-solid fa-book-open",
    classModifier: "activity-reading",
  },
  planejando: {
    label: "Planejando",
    icon: "fa-solid fa-list-check",
    classModifier: "activity-planning",
  },
  pensando: {
    label: "Pensando",
    icon: "fa-solid fa-brain",
    classModifier: "activity-thinking",
  },
  executando: {
    label: "Executando",
    icon: "fa-solid fa-gear fa-spin",
    classModifier: "activity-running",
  },
  testando: {
    label: "Testando",
    icon: "fa-solid fa-vial",
    classModifier: "activity-testing",
  },
  aguardando_resposta: {
    label: "Aguardando resposta",
    icon: "fa-solid fa-user-clock",
    classModifier: "activity-waiting",
  },
  hibernando: {
    label: "Hibernando",
    icon: "fa-solid fa-moon",
    classModifier: "activity-hibernating",
  },
  inativo: {
    label: "Inativo",
    icon: "fa-regular fa-circle-dot",
    classModifier: "activity-inactive",
  },
});

/**
 * Mapeia os estados legados de escritório para os novos estados de atividade canônicos.
 * @param {string} legacyState
 * @returns {AtividadeEstado}
 */
function mapLegacyOfficeState(legacyState) {
  switch (legacyState) {
    case "thinking":
      return "pensando";
    case "streaming":
      return "executando";
    case "waiting_approval":
      return "aguardando_resposta";
    case "offline":
      return "inativo";
    case "idle":
    default:
      return "hibernando";
  }
}

/**
 * Retorna as informações de exibição para um estado de atividade.
 * @param {AtividadeEstado | string} state
 * @returns {{ label: string, icon: string, classModifier: string }}
 */
function getActivityDisplay(state) {
  return ACTIVITY_DISPLAY_MAP[/** @type {AtividadeEstado} */ (state)] || ACTIVITY_DISPLAY_MAP.inativo;
}

module.exports = {
  ACTIVITY_DISPLAY_MAP,
  mapLegacyOfficeState,
  getActivityDisplay,
};

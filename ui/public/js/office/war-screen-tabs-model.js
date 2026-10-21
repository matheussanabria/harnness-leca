// @ts-check
// Abas de projeção do telão da Sala de Guerra (EP-05.06).
// A projeção do Scrum é uma escolha explícita: o conteúdo atual não é trocado sozinho.

export const WAR_SCREEN_TABS = Object.freeze([
  {
    id: "orchestration",
    label: "Orquestração",
    description: "Workflows, jobs e telemetria dos agentes",
    icon: "fa-solid fa-network-wired"
  },
  {
    id: "kanban",
    label: "Kanban Scrum",
    description: "Raias e histórias da sprint ativa",
    icon: "fa-solid fa-table-columns"
  }
]);

const DEFAULT_WAR_SCREEN_PRESET = "orchestration";

export function normalizeWarScreenPreset(presetId) {
  return WAR_SCREEN_TABS.some((tab) => tab.id === presetId)
    ? presetId
    : DEFAULT_WAR_SCREEN_PRESET;
}

export function getWarScreenTab(presetId) {
  const normalized = normalizeWarScreenPreset(presetId);
  return WAR_SCREEN_TABS.find((tab) => tab.id === normalized) || WAR_SCREEN_TABS[0];
}

export function isScrumProjection(presetId) {
  return normalizeWarScreenPreset(presetId) === "kanban";
}

// @ts-check
// Carga dos dados de Scrum; o catálogo de raias vem do backend.
import { showToast } from "../shared/dom.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";

export async function loadScrumData(slug) {
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum`);
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || "Erro ao carregar dados de Scrum.");
      return null;
    }
    ds.currentScrumData = data.scrum;
    return ds.currentScrumData;
  } catch {
    showToast("Falha de conexao com o servico de Scrum.");
    return null;
  }
}

export function setScrumSubTab(tab) {
  ds.currentScrumTab = tab;
  renderCurrentScrumView();
}

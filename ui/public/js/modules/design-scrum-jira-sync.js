// @ts-check
// Botao "Sincronizar Jira": pede ao servidor um snapshot novo e re-renderiza o quadro.
import { showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderScrumWorkspace } from "./design-scrum-view.js";

export function jiraSyncButtonHtml(scrumData) {
  if (!scrumData?.source?.file) return "";
  const exported = scrumData.source.exportedAt ? new Date(scrumData.source.exportedAt).toLocaleString("pt-BR") : "desconhecida";
  return `<button type="button" id="scrumJiraSyncBtn" class="scrum-nav-tab scrum-jira-sync" onclick="syncScrumJira()" title="Ultima atualizacao do Jira: ${exported}">
    <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Jira</button>`;
}

export function registerJiraSync() {
  window.syncScrumJira = async () => {
    const slug = state.P?.name || state.S?.active;
    const button = document.getElementById("scrumJiraSyncBtn");
    if (button) { button.disabled = true; button.classList.add("is-syncing"); button.innerHTML = '<i class="fa-solid fa-arrows-rotate scrum-sync-icon"></i> Sincronizando...'; }
    try {
      const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/jira-sync`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao sincronizar com o Jira.");
      const container = document.getElementById("scrumContentBody")?.closest(".scrum-workspace-layout")?.parentElement;
      if (container) renderScrumWorkspace(container, slug, data.scrum);
      else ds.currentScrumData = data.scrum;
      showToast(`Jira sincronizado: ${data.sync.issues} itens, ${data.sync.withSprint} com sprint, ${data.sync.withComments} com comentarios.`, 6000);
    } catch (error) {
      showToast(error.message);
      if (button) { button.disabled = false; button.classList.remove("is-syncing"); button.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sincronizar Jira'; }
    }
  };
}

// @ts-check
// Configuracao explicita entre status de origem e colunas do quadro local.
import { esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";

export function registerStatusMapping() {
  window.openStatusMappingModal = () => {
    const statuses = ds.currentScrumData?.sourceStatuses || [];
    const lanes = (ds.currentScrumData?.lanes || []).filter((lane) => lane.active);
    let dialog = /** @type {HTMLDialogElement} */ (document.getElementById("scrumStatusMappingDialog"));
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "scrumStatusMappingDialog";
      dialog.className = "dlg-modal scrum-status-mapping-dialog";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="dlg-head"><h3>Mapeamento de status</h3><button type="button" class="dlg-close" onclick="this.closest('dialog').close()" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>
      <p class="scrum-mapping-help">Escolha em qual coluna cada status do snapshot Jira aparece. Historias movidas manualmente preservam sua coluna local.</p>
      <div class="scrum-mapping-list">${statuses.map((status) => `<label><span><b>${esc(status.name)}</b><small>${esc(status.category || "sem categoria")}</small></span><select data-source-status="${esc(status.id || status.name)}">${lanes.map((lane) => `<option value="${esc(lane.id)}" ${lane.id === status.boardLaneId ? "selected" : ""}>${esc(lane.name)}</option>`).join("")}</select></label>`).join("")}</div>
      <div class="scrum-mapping-actions"><button type="button" class="btn-card-action" onclick="this.closest('dialog').close()">Cancelar</button><button type="button" class="btn-send" onclick="saveStatusMapping()"><i class="fa-solid fa-floppy-disk"></i> Salvar</button></div>`;
    dialog.showModal();
  };

  window.saveStatusMapping = async () => {
    const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("scrumStatusMappingDialog"));
    const mapping = Object.fromEntries([...dialog.querySelectorAll("select[data-source-status]")].map((select) => [select.dataset.sourceStatus, select.value]));
    const slug = state.P?.name || state.S?.active;
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/status-mapping`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapping }) });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || "Falha ao salvar o mapeamento.");
    ds.currentScrumData = data.scrum;
    dialog.close();
    renderCurrentScrumView();
    showToast("Mapeamento de status atualizado.");
  };
}

// @ts-check
// Modal acessível para configurar os atributos editáveis das raias canônicas.
import { esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";

function laneFields(lane) {
  return `<fieldset class="scrum-lane-config-item" data-lane-id="${esc(lane.id)}">
    <legend><i class="fa-solid fa-${esc(lane.icon)}" aria-hidden="true"></i> ${esc(lane.name)}</legend>
    <div class="scrum-lane-fields"><label>Nome<input data-field="name" maxlength="60" required value="${esc(lane.name)}"></label>
    <label>Cor<input data-field="color" type="color" value="${esc(lane.color)}"></label></div>
    <label>Descrição<textarea data-field="description" maxlength="240" rows="2">${esc(lane.description)}</textarea></label>
    <div class="scrum-lane-toggles"><label><input data-field="visible" type="checkbox" ${lane.visible ? "checked" : ""}> Visível no quadro</label>
    <label><input data-field="active" type="checkbox" ${lane.active ? "checked" : ""}> Ativa para o workflow</label></div>
    <small>ID estável: ${esc(lane.id)}</small>
  </fieldset>`;
}

function readLanes(dialog) {
  return [...dialog.querySelectorAll("[data-lane-id]")].map((item) => ({
    id: item.dataset.laneId,
    name: item.querySelector('[data-field="name"]').value,
    description: item.querySelector('[data-field="description"]').value,
    color: item.querySelector('[data-field="color"]').value,
    visible: item.querySelector('[data-field="visible"]').checked,
    active: item.querySelector('[data-field="active"]').checked,
  }));
}

export function registerLaneConfig() {
  const openLaneConfigModal = () => {
    let dialog = /** @type {HTMLDialogElement} */ (document.getElementById("scrumLaneConfigDialog"));
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "scrumLaneConfigDialog";
      dialog.className = "dlg-modal scrum-lane-config-dialog";
      document.body.appendChild(dialog);
    }
    const lanes = ds.currentScrumData?.lanes || [];
    dialog.innerHTML = `<form method="dialog" onsubmit="event.preventDefault();saveLaneConfig()"><div class="dlg-head"><h3 id="scrumLaneConfigTitle">Configurar raias</h3><button type="button" class="dlg-close" onclick="this.closest('dialog').close()" aria-label="Fechar configuração de raias"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
      <p id="scrumLaneConfigHelp" class="scrum-mapping-help">Personalize as 12 raias. Os IDs e a ordem permanecem fixos nesta entrega.</p>
      <div class="scrum-lane-config-list">${lanes.map(laneFields).join("")}</div>
      <div class="scrum-mapping-actions"><button type="button" class="btn-card-action" onclick="this.closest('dialog').close()">Cancelar</button><button type="submit" class="btn-send"><i class="fa-solid fa-floppy-disk"></i> Salvar configuração</button></div></form>`;
    dialog.setAttribute("aria-labelledby", "scrumLaneConfigTitle");
    dialog.setAttribute("aria-describedby", "scrumLaneConfigHelp");
    dialog.showModal();
    dialog.querySelector("input")?.focus();
  };

  const saveLaneConfig = async () => {
    const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("scrumLaneConfigDialog"));
    if (!dialog.querySelector("form")?.reportValidity()) return;
    const slug = state.P?.name || state.S?.active;
    const payload = { lanes: readLanes(dialog), expectedRevision: ds.currentScrumData?.lanesRevision ?? 0 };
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/lanes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || "Falha ao salvar a configuração das raias.");
    ds.currentScrumData = data.scrum;
    dialog.close();
    renderCurrentScrumView();
    showToast("Configuração das raias atualizada.");
  };
  Object.assign(window, { openLaneConfigModal, saveLaneConfig });
}

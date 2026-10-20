// @ts-check
// Modais de nova sprint e novo épico.
import { $, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";

export function registerSprintEpicModals() {
  // Modal para Nova Sprint
  // @ts-ignore
  window.openNewSprintModal = () => {
    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Nome da Sprint:</label>
          <input type="text" id="dlgSprintName" class="chats-search-input" style="width:100%;margin-top:3px" placeholder="Ex: Sprint 2 — Entregas e Relatórios">
        </div>
        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Meta da Sprint (Sprint Goal):</label>
          <input type="text" id="dlgSprintGoal" class="chats-search-input" style="width:100%;margin-top:3px" placeholder="Ex: Finalizar regras de cálculo e integração REST">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Data de Início:</label>
            <input type="date" id="dlgSprintStart" class="chats-search-input" style="width:100%;margin-top:3px" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Data de Término:</label>
            <input type="date" id="dlgSprintEnd" class="chats-search-input" style="width:100%;margin-top:3px" value="${new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}">
          </div>
        </div>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="dlgSprintMakeActive" checked>
          Tornar esta a Sprint Ativa imediatamente
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button type="button" class="btn-card-action" onclick="document.getElementById('scrumSprintDialog').close()">Cancelar</button>
          <button type="button" class="btn-send" style="padding:6px 16px" onclick="saveSprintModalAction()">Criar Sprint</button>
        </div>
      </div>
    `;

    let dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumSprintDialog"));
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "scrumSprintDialog";
      dlg.className = "dlg-modal";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = `
      <div class="dlg-head">
        <h3>Nova Sprint</h3>
        <button type="button" class="dlg-close" onclick="document.getElementById('scrumSprintDialog').close()">×</button>
      </div>
      ${html}
    `;
    dlg.showModal();
  };

  // @ts-ignore
  window.saveSprintModalAction = async () => {
    const name = /** @type {HTMLInputElement} */ ($("dlgSprintName")).value.trim();
    if (!name) {
      showToast("O nome da sprint é obrigatório.");
      return;
    }
    const goal = /** @type {HTMLInputElement} */ ($("dlgSprintGoal")).value.trim();
    const startDate = /** @type {HTMLInputElement} */ ($("dlgSprintStart")).value;
    const endDate = /** @type {HTMLInputElement} */ ($("dlgSprintEnd")).value;
    const makeActive = (/** @type {HTMLInputElement} */ ($("dlgSprintMakeActive"))).checked;

    const payload = {
      name,
      goal,
      startDate,
      endDate,
      makeActive,
    };

    const slug = state.P?.name || state.S?.active;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/sprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        ds.currentScrumData = data.scrum;
        const dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumSprintDialog"));
        if (dlg) dlg.close();
        renderCurrentScrumView();
        showToast("Nova Sprint criada!");
      }
    } catch {
      showToast("Falha ao criar sprint.");
    }
  };

  // Modal para Novo Épico
  // @ts-ignore
  window.openNewEpicModal = () => {
    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Título do Épico:</label>
          <input type="text" id="dlgEpicTitle" class="chats-search-input" style="width:100%;margin-top:3px" placeholder="Ex: Dispensação de Medicamentos">
        </div>
        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Descrição do Valor:</label>
          <textarea id="dlgEpicDesc" class="chats-search-input" style="width:100%;height:60px;margin-top:3px;font-family:inherit" placeholder="Ex: Fluxos completos de entrega, conferência e cálculos"></textarea>
        </div>
        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Cor Temática:</label>
          <div style="display:flex;gap:8px;margin-top:4px" id="dlgEpicColors">
            ${["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6"].map((c, i) => `
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
                <input type="radio" name="epicColor" value="${c}" ${i === 0 ? 'checked' : ''}>
                <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c}"></span>
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button type="button" class="btn-card-action" onclick="document.getElementById('scrumEpicDialog').close()">Cancelar</button>
          <button type="button" class="btn-send" style="padding:6px 16px" onclick="saveEpicModalAction()">Criar Épico</button>
        </div>
      </div>
    `;

    let dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumEpicDialog"));
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "scrumEpicDialog";
      dlg.className = "dlg-modal";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = `
      <div class="dlg-head">
        <h3>Novo Épico</h3>
        <button type="button" class="dlg-close" onclick="document.getElementById('scrumEpicDialog').close()">×</button>
      </div>
      ${html}
    `;
    dlg.showModal();
  };

  // @ts-ignore
  window.saveEpicModalAction = async () => {
    const title = /** @type {HTMLInputElement} */ ($("dlgEpicTitle")).value.trim();
    if (!title) {
      showToast("O título do épico é obrigatório.");
      return;
    }
    const description = (/** @type {HTMLTextAreaElement} */ ($("dlgEpicDesc"))).value.trim();
    const colorInput = /** @type {HTMLInputElement} */ (document.querySelector('input[name="epicColor"]:checked'));
    const color = colorInput ? colorInput.value : "#6366f1";

    const payload = {
      title,
      description,
      color,
    };

    const slug = state.P?.name || state.S?.active;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/epic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        ds.currentScrumData = data.scrum;
        const dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumEpicDialog"));
        if (dlg) dlg.close();
        renderCurrentScrumView();
        showToast("Novo Épico criado!");
      }
    } catch {
      showToast("Falha ao criar épico.");
    }
  };
}

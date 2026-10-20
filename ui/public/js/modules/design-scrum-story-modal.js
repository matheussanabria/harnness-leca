// @ts-check
// Modal de criar/editar história.
import { $, esc, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { ds } from "./design-scrum-store.js";
import { renderCurrentScrumView } from "./design-scrum-view.js";

export function registerStoryModal() {
  // Modal para Criar/Editar História
  // @ts-ignore
  window.openNewStoryModal = () => openStoryFormModal(null);
  // @ts-ignore
  window.openEditStoryModal = (story) => openStoryFormModal(story);

  function openStoryFormModal(story) {
    const isEdit = Boolean(story);
    const epics = ds.currentScrumData?.epics || [];
    const sprints = ds.currentScrumData?.sprints || [];
    const activeSpId = ds.currentScrumData?.activeSprintId;

    const epicOpts = epics.map((e) => `<option value="${esc(e.id)}" ${story?.epicId === e.id ? "selected" : ""}>${esc(e.title)}</option>`).join("");
    const sprintOpts = [
      `<option value="">Backlog (Fora de Sprint)</option>`,
      ...sprints.map((s) => `<option value="${esc(s.id)}" ${(story?.sprintId || (!isEdit ? activeSpId : '')) === s.id ? "selected" : ""}>${esc(s.name)}</option>`),
    ].join("");

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        <div style="display:grid;grid-template-columns:1fr 140px;gap:10px">
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Título da História:</label>
            <input type="text" id="dlgStoryTitle" class="chats-search-input" style="width:100%;margin-top:3px" placeholder="Ex: Consulta de Pacientes por CNS" value="${esc(story?.title || '')}">
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Chave (Ex: DIS-443):</label>
            <input type="text" id="dlgStoryKey" class="chats-search-input" style="width:100%;margin-top:3px" placeholder="Automático" value="${esc(story?.key || '')}">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Épico:</label>
            <select id="dlgStoryEpic" class="scrum-sprint-select" style="width:100%;margin-top:3px">
              <option value="">Sem Épico</option>
              ${epicOpts}
            </select>
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Sprint / Alocação:</label>
            <select id="dlgStorySprint" class="scrum-sprint-select" style="width:100%;margin-top:3px">
              ${sprintOpts}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Story Points:</label>
            <select id="dlgStoryPoints" class="scrum-sprint-select" style="width:100%;margin-top:3px">
              <option value="" ${story?.points == null ? "selected" : ""}>Nao informado</option>
              ${[1, 2, 3, 5, 8, 13, 21].map((p) => `<option value="${p}" ${story?.points === p ? "selected" : ""}>${p} pontos</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Prioridade:</label>
            <select id="dlgStoryPriority" class="scrum-sprint-select" style="width:100%;margin-top:3px">
              <option value="" ${story?.priority == null ? "selected" : ""}>Nao informada</option>
              <option value="baixa" ${story?.priority === 'baixa' ? 'selected' : ''}>Baixa</option>
              <option value="media" ${story?.priority === 'media' ? 'selected' : ''}>Média</option>
              <option value="alta" ${story?.priority === 'alta' ? 'selected' : ''}>Alta</option>
              <option value="critica" ${story?.priority === 'critica' ? 'selected' : ''}>Crítica</option>
            </select>
          </div>
          <div>
            <label style="font-size:11.5px;font-weight:600;color:var(--mute)">${isEdit ? "Status legado (movimente no quadro):" : "Status:"}</label>
            <select id="dlgStoryStatus" class="scrum-sprint-select" style="width:100%;margin-top:3px" ${isEdit ? "disabled" : ""}>
              <option value="todo" ${story?.status === 'todo' ? 'selected' : ''}>A Fazer</option>
              <option value="in_progress" ${story?.status === 'in_progress' ? 'selected' : ''}>Em Progresso</option>
              <option value="review" ${story?.status === 'review' ? 'selected' : ''}>Em Revisão / QA</option>
              <option value="done" ${story?.status === 'done' ? 'selected' : ''}>Concluído</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Descrição da História (User Story):</label>
          <textarea id="dlgStoryDesc" class="chats-search-input" style="width:100%;height:60px;margin-top:3px;font-family:inherit" placeholder="Como [usuário], Quero [ação], Para que [benefício]">${esc(story?.description || '')}</textarea>
        </div>

        <div>
          <label style="font-size:11.5px;font-weight:600;color:var(--mute)">Critérios de Aceite (1 por linha):</label>
          <textarea id="dlgStoryCriteria" class="chats-search-input" style="width:100%;height:70px;margin-top:3px;font-family:inherit" placeholder="Um criterio por linha">${esc((story?.acceptanceCriteria || []).map((criterion) => typeof criterion === "string" ? criterion : `${criterion.label}: ${criterion.content}`).join('\n'))}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button type="button" class="btn-card-action" onclick="document.getElementById('scrumStoryDialog').close()">Cancelar</button>
          <button type="button" class="btn-send" style="padding:6px 16px" onclick="saveStoryModalAction('${esc(story?.id || '')}')">
            ${isEdit ? 'Salvar Alterações' : 'Criar História'}
          </button>
        </div>
      </div>
    `;

    let dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumStoryDialog"));
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "scrumStoryDialog";
      dlg.className = "dlg-modal";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = `
      <div class="dlg-head">
        <h3>${isEdit ? `Editar História ${story.key}` : 'Nova História de Usuário'}</h3>
        <button type="button" class="dlg-close" onclick="document.getElementById('scrumStoryDialog').close()">×</button>
      </div>
      ${html}
    `;
    dlg.showModal();
  }

  // @ts-ignore
  window.saveStoryModalAction = async (existingId) => {
    const title = /** @type {HTMLInputElement} */ ($("dlgStoryTitle")).value.trim();
    if (!title) {
      showToast("O título da história é obrigatório.");
      return;
    }
    const key = /** @type {HTMLInputElement} */ ($("dlgStoryKey")).value.trim();
    const epicId = /** @type {HTMLSelectElement} */ ($("dlgStoryEpic")).value || null;
    const sprintId = /** @type {HTMLSelectElement} */ ($("dlgStorySprint")).value || null;
    const pointsValue = (/** @type {HTMLSelectElement} */ ($("dlgStoryPoints"))).value;
    const points = pointsValue ? parseInt(pointsValue, 10) : null;
    const priority = (/** @type {HTMLSelectElement} */ ($("dlgStoryPriority"))).value || null;
    const status = (/** @type {HTMLSelectElement} */ ($("dlgStoryStatus"))).value;
    const description = (/** @type {HTMLTextAreaElement} */ ($("dlgStoryDesc"))).value.trim();
    const criteriaRaw = (/** @type {HTMLTextAreaElement} */ ($("dlgStoryCriteria"))).value;
    const acceptanceCriteria = criteriaRaw.split("\n").map((c) => c.trim()).filter(Boolean);

    const payload = {
      id: existingId || (key ? key.toLowerCase() : `us-${Date.now()}`),
      key: key || undefined,
      title,
      epicId,
      sprintId,
      points,
      priority,
      status,
      description,
      acceptanceCriteria,
    };

    const slug = state.P?.name || state.S?.active;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(slug)}/scrum/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        ds.currentScrumData = data.scrum;
        const dlg = /** @type {HTMLDialogElement} */ (document.getElementById("scrumStoryDialog"));
        if (dlg) dlg.close();
        renderCurrentScrumView();
        showToast("História gravada com sucesso!");
      }
    } catch {
      showToast("Falha ao salvar história.");
    }
  };
}

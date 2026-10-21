// @ts-check
// Backlog do produto e área de épicos.
import { esc } from "../shared/dom.js";
import { ds } from "./design-scrum-store.js";
import { visibleStories } from "./design-scrum-filters.js";

/**
 * Renderiza a visão em lista do Backlog do Produto.
 * @param {any} scrum
 */
export function renderProductBacklog(scrum) {
  const epics = scrum.epics || [];
  const activeSprint = scrum.sprints?.find((s) => s.id === scrum.activeSprintId);

  let filtered = visibleStories(scrum, { scope: "all" });
  if (ds.currentEpicFilter !== "all") {
    filtered = filtered.filter((s) => s.epicId === ds.currentEpicFilter);
  }

  const epicFilterOptions = [
    `<option value="all">Todos os Épicos (${epics.length})</option>`,
    ...epics.map((e) => `<option value="${esc(e.id)}" ${e.id === ds.currentEpicFilter ? "selected" : ""}>${esc(e.title)}</option>`),
  ].join("");

  const rowsHtml = filtered.map((st, i) => {
    const epic = epics.find((e) => e.id === st.epicId);
    const inSprint = Boolean(st.sprintId);
    const sprintObj = scrum.sprints?.find((sp) => sp.id === st.sprintId);

    return `
      <tr>
        <td style="color:var(--mute);font-size:11px;width:30px">${i + 1}</td>
        <td style="width:90px"><span class="story-key-badge">${esc(st.key)}</span></td>
        <td>
          <div style="font-weight:600;font-size:13px;cursor:pointer" onclick="openStoryDetailsById('${esc(st.id)}')">
            ${esc(st.title)}
          </div>
          ${st.description ? `<div style="font-size:11.5px;color:var(--mute);margin-top:2px">${esc(st.description.slice(0, 100))}</div>` : ""}
        </td>
        <td style="width:140px">
          ${epic ? `<span class="story-epic-chip" style="background:${esc(epic.color || '#6366f1')}20;color:${esc(epic.color || '#6366f1')};border-color:${esc(epic.color || '#6366f1')}40">${esc(epic.title)}</span>` : '<span style="color:var(--mute);font-size:11px">—</span>'}
        </td>
        <td style="width:70px;text-align:center">${st.points != null ? `<span class="story-pts-badge">${st.points} pts</span>` : ""}</td>
        <td style="width:80px;text-align:center">
          ${st.priority ? `<span style="font-size:10.5px;font-weight:700;text-transform:uppercase" class="priority-${esc(st.priority)}"><i class="fa-solid fa-flag"></i> ${esc(st.priority)}</span>` : ""}
        </td>
        <td style="width:110px;text-align:center">
          <span class="audit-tag tag-${st.status === 'done' ? 'ok' : (st.status === 'in_progress' ? 'auto' : 'none')}">
            ${esc(st.status)}
          </span>
        </td>
        <td style="width:130px;text-align:center">
          ${inSprint ? `<span style="font-size:11px;color:#22c55e;font-weight:600"><i class="fa-solid fa-person-running"></i> ${esc(sprintObj?.name || 'Sprint')}</span>` : '<span style="font-size:11px;color:var(--mute)"><i class="fa-solid fa-inbox"></i> Backlog</span>'}
        </td>
        <td style="width:180px;text-align:right">
          <div style="display:flex;justify-content:flex-end;gap:4px">
            ${inSprint
              ? `<button type="button" class="btn-card-action" onclick="assignStoryToSprint('${esc(st.id)}', null)" title="Remover da sprint e mover para o backlog"><i class="fa-solid fa-inbox"></i> Backlog</button>`
              : `<button type="button" class="btn-card-action" onclick="assignStoryToSprint('${esc(st.id)}', '${esc(activeSprint?.id || 'sprint-1')}')" title="Adicionar à sprint ativa"><i class="fa-solid fa-bolt"></i> Na Sprint</button>`
            }
            <button type="button" class="btn-card-action" onclick="openEditStoryById('${esc(st.id)}')" title="Editar história"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn-card-action" onclick="sendStoryToChatById('${esc(st.id)}')" title="Implementar no Chat"><i class="fa-solid fa-message"></i></button>
            <button type="button" class="btn-card-action" style="color:#ef4444" onclick="confirmDeleteStory('${esc(st.id)}')" title="Excluir história"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="audit-panel-box" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
      <div class="audit-panel-header">
        <div>
          <h3 style="margin:0;font-size:15px;color:var(--text)">Product Backlog (${filtered.length} histórias)</h3>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">
            Lista priorizada de histórias de usuário. Mova itens para a Sprint ativa com 1 clique.
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px">
          <select class="scrum-sprint-select" onchange="onEpicFilterChange(this.value)">
            ${epicFilterOptions}
          </select>
          <button type="button" class="btn-card-action" onclick="openNewStoryModal()"><i class="fa-solid fa-plus"></i> Nova História</button>
        </div>
      </div>

      <div style="overflow-x:auto;overflow-y:auto;flex:1">
        <table class="audit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Chave</th>
              <th>História de Usuário</th>
              <th>Épico</th>
              <th style="text-align:center">Pontos</th>
              <th style="text-align:center">Prioridade</th>
              <th style="text-align:center">Status</th>
              <th style="text-align:center">Alocação</th>
              <th style="text-align:right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--mute)">Nenhuma história cadastrada no backlog.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Renderiza a visão de Épicos & Metas.
 * @param {any} scrum
 */
export function renderEpicsWorkspace(scrum) {
  const epics = scrum.epics || [];
  const stories = scrum.stories || [];

  const epicsCards = epics.map((ep) => {
    const epicStories = stories.filter((s) => s.epicId === ep.id);
    const totalPoints = epicStories.reduce((acc, s) => acc + (s.points || 0), 0);
    const doneStories = epicStories.filter((s) => s.status === "done");
    const percent = epicStories.length > 0 ? Math.round((doneStories.length / epicStories.length) * 100) : 0;

    return `
      <div class="scrum-epic-card" style="border-top:4px solid ${esc(ep.color || '#6366f1')}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div>
            <span style="font-size:11px;font-weight:700;color:${esc(ep.color || '#6366f1')}">${esc(ep.id)}</span>
            <h3 style="margin:2px 0 0;font-size:15px;color:var(--text)">${esc(ep.title)}</h3>
          </div>
          <span class="story-pts-badge">${totalPoints} pts</span>
        </div>

        <div style="font-size:12px;color:var(--mute);margin-bottom:12px">
          ${esc(ep.description || "Sem descrição informada.")}
        </div>

        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mute);margin-bottom:3px">
            <span>Progresso: <b>${doneStories.length}/${epicStories.length} histórias</b></span>
            <span>${percent}%</span>
          </div>
          <div class="scorecard-progress-bar">
            <div class="scorecard-progress-fill" style="width:${percent}%;background:${esc(ep.color || '#6366f1')}"></div>
          </div>
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--mute);margin-bottom:6px;text-transform:uppercase">
          Histórias vinculadas (${epicStories.length}):
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto">
          ${epicStories.map((s) => `
            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--panel2);padding:4px 8px;border-radius:4px;font-size:11.5px">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:6px">
                <b>${esc(s.key)}:</b> ${esc(s.title)}
              </span>
              <span class="audit-tag tag-${s.status === 'done' ? 'ok' : 'auto'}">${esc(s.status)}</span>
            </div>
          `).join('') || '<div style="color:var(--mute);font-size:11px">Nenhuma história vinculada a este épico.</div>'}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div style="display:flex;flex-direction:column;gap:14px;flex:1;overflow:hidden">
      <div class="audit-panel-header" style="background:var(--panel);padding:12px 16px;border-radius:8px;border:1px solid var(--line)">
        <div>
          <h3 style="margin:0;font-size:15px;color:var(--text)">Épicos do Projeto (${epics.length} épicos)</h3>
          <div style="font-size:11.5px;color:var(--mute);margin-top:2px">Grandes blocos de entrega e valor de negócio que agrupam histórias de usuário.</div>
        </div>
        <button type="button" class="btn-card-action" onclick="openNewEpicModal()"><i class="fa-solid fa-plus"></i> Novo Épico</button>
      </div>

      <div class="scrum-epics-grid">
        ${epicsCards || '<div style="color:var(--mute);padding:32px;text-align:center">Nenhum épico cadastrado.</div>'}
      </div>
    </div>
  `;
}

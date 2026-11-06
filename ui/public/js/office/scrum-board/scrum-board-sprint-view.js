// @ts-check
// Markup of the sprint bar (selector, progress, start and close) and of the story detail. Pure and escaped.
import { esc } from "../../shared/dom.js";
import { traceBodyHtml, traceErrorHtml, traceLoadingHtml } from "../../modules/design-scrum-story-trace-view.js";
import { ALL, SPRINT_STATUS_LABEL, closePreview, daysLeft, sprintActions, sprintProgress } from "./scrum-board-model.js";

/** @param {any} sprint @param {number} now */
function dateLine(sprint, now) {
  const left = daysLeft(sprint, now);
  const range = `${esc(sprint.startDate || "?")} a ${esc(sprint.endDate || "?")}`;
  if (sprint.status !== "active" || left === null) return range;
  return `${range} - ${left >= 0 ? `${left} dia(s) restantes` : `${-left} dia(s) de atraso`}`;
}

/** @param {any} sprint */
function closedSummary(sprint) {
  const s = sprint.summary;
  if (!s) return "";
  return `<p class="sb-note"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Entregue ${esc(String(s.completedPoints))} de ${esc(String(s.committedPoints))} pts; ${esc(String(s.carriedStories?.length || 0))} historia(s) voltaram para ${s.carryOver === "next" ? "a proxima sprint" : "o backlog"}.</p>`;
}

/** @param {{ scrum: any, viewId: string, busy: boolean, confirmClose: boolean, now?: number }} input */
export function sprintBarHtml({ scrum, viewId, busy, confirmClose, now = Date.now() }) {
  const options = [`<option value="${ALL}"${viewId === ALL ? " selected" : ""}>Todas as historias</option>`]
    .concat((scrum.sprints || []).map((sprint) => `<option value="${esc(sprint.id)}"${sprint.id === viewId ? " selected" : ""}>${esc(sprint.name)} (${esc(SPRINT_STATUS_LABEL[sprint.status] || sprint.status || "?")})</option>`));
  const select = `<label class="sb-field"><span class="sb-sr">Sprint visualizada</span><select data-view aria-label="Sprint visualizada">${options.join("")}</select></label>`;
  const sprint = (scrum.sprints || []).find((item) => item.id === viewId);
  if (!sprint) return `<div class="sb-bar">${select}<span class="sb-note">Todas as sprints e o backlog.</span></div>`;

  const progress = sprintProgress(scrum, sprint.id);
  const actions = sprintActions(scrum, sprint);
  const dis = busy ? " disabled" : "";
  let buttons = "";
  if (actions.canStart) buttons = `<button type="button" class="sb-btn is-primary" data-sprint-start="${esc(sprint.id)}"${dis}><i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar sprint</button>`;
  else if (actions.blockedBy) buttons = `<span class="sb-note"><i class="fa-solid fa-lock" aria-hidden="true"></i> Encerre "${esc(actions.blockedBy)}" para iniciar esta.</span>`;
  else if (actions.canClose && !confirmClose) buttons = `<button type="button" class="sb-btn" data-sprint-close-ask="1"${dis}><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Encerrar sprint</button>`;
  return `<div class="sb-bar">
    ${select}
    <span class="sb-badge is-${esc(sprint.status)}">${esc(SPRINT_STATUS_LABEL[sprint.status] || sprint.status)}</span>
    <span class="sb-note">${dateLine(sprint, now)}</span>
    <span class="sb-progress" role="img" aria-label="${progress.percent}% concluido"><span style="width:${progress.percent}%"></span></span>
    <span class="sb-note">${progress.donePoints}/${progress.points} pts</span>
    ${buttons}
    ${sprint.goal ? `<p class="sb-goal"><i class="fa-solid fa-bullseye" aria-hidden="true"></i> ${esc(sprint.goal)}</p>` : `<p class="sb-goal is-missing"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Sem meta definida.</p>`}
    ${sprint.status === "closed" ? closedSummary(sprint) : ""}
    ${actions.canClose && confirmClose ? closeConfirmHtml(scrum, sprint, actions, busy) : ""}
  </div>`;
}

function closeConfirmHtml(scrum, sprint, actions, busy) {
  const p = closePreview(scrum, sprint.id);
  const next = actions.nextOptions.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  return `<div class="sb-confirm" role="group" aria-label="Confirmar encerramento">
    <p class="sb-note">Entregues: ${p.doneStories} (${p.donePoints} pts). Nao concluidas: ${p.carriedStories} (${p.carriedPoints} pts).</p>
    <label class="sb-field">Nao concluidas vao para
      <select data-carry aria-label="Destino das historias nao concluidas"><option value="backlog">Backlog</option>${next ? `<optgroup label="Proxima sprint">${next}</optgroup>` : ""}</select>
    </label>
    <button type="button" class="sb-btn is-danger" data-sprint-close="${esc(sprint.id)}"${busy ? " disabled" : ""}><i class="fa-solid fa-check" aria-hidden="true"></i> Confirmar encerramento</button>
    <button type="button" class="sb-btn" data-sprint-close-cancel="1"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Cancelar</button>
  </div>`;
}

/** @param {any} scrum @param {any} story @param {any} trace @param {boolean} form @param {boolean} busy */
export function detailHtml(scrum, story, trace, form, busy) {
  if (!story) return `<aside class="sb-detail"><p class="sb-empty">Selecione uma historia para ver os detalhes.</p></aside>`;
  const lane = (scrum.lanes || []).find((item) => item.id === story.laneId);
  const sprint = (scrum.sprints || []).find((item) => item.id === story.sprintId);
  const epic = (scrum.epics || []).find((item) => item.id === story.epicId);
  const criteria = (story.acceptanceCriteria || []).map((item) => `<li>${esc(item)}</li>`).join("");
  const blocked = Boolean(story.impediment?.active);
  const row = (/** @type {string} */ label, /** @type {string} */ value) => `<dt>${label}</dt><dd>${esc(value)}</dd>`;
  const traceBody = !trace ? traceLoadingHtml() : trace.ok ? traceBodyHtml(trace.data) : traceErrorHtml(trace.error || "Falha ao carregar.");
  return `<aside class="sb-detail" aria-label="Detalhes da historia">
    <header><span class="sb-key">${esc(story.key || story.id)}</span><h3>${esc(story.title)}</h3>
      <button type="button" class="sb-btn" data-story-close="1" aria-label="Fechar detalhes"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <dl>${row("Raia", lane?.name || story.laneId)}${row("Sprint", sprint?.name || "Backlog")}${row("Epico", epic?.title || "Sem epico")}${row("Pontos", story.points != null ? String(story.points) : "-")}${row("Prioridade", story.priority || "-")}</dl>
    ${story.description ? `<h4>Descricao</h4><p>${esc(story.description)}</p>` : ""}
    ${criteria ? `<h4>Criterios de aceite</h4><ul>${criteria}</ul>` : ""}
    <div class="sb-impediment">${blocked
      ? `<p class="sb-note is-danger"><i class="fa-solid fa-ban" aria-hidden="true"></i> Impedida: ${esc(story.impediment.reason)}</p><button type="button" class="sb-btn" data-impediment-resolve="1"${busy ? " disabled" : ""}><i class="fa-solid fa-check" aria-hidden="true"></i> Resolver impedimento</button>`
      : form
        ? `<label class="sb-field">Motivo<input type="text" data-impediment-reason maxlength="200" aria-label="Motivo do impedimento"></label><button type="button" class="sb-btn is-danger" data-impediment-save="1"${busy ? " disabled" : ""}>Registrar</button><button type="button" class="sb-btn" data-impediment-toggle="1">Cancelar</button>`
        : `<button type="button" class="sb-btn" data-impediment-toggle="1"><i class="fa-solid fa-ban" aria-hidden="true"></i> Marcar impedimento</button>`}</div>
    <div class="sb-trace">${traceBody}</div>
  </aside>`;
}

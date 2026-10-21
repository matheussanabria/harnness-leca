// @ts-check
// Cartao resumido: abre detalhes; editar permanece uma acao explicita.
import { esc } from "../shared/dom.js";

function icon(name, label = "") {
  return `<i class="fa-solid fa-${name}" aria-hidden="true"></i>${label ? ` ${label}` : ""}`;
}

export function renderStoryCard(story, epics = [], transitions = {}, lanes = []) {
  const epic = epics.find((item) => item.id === story.epicId);
  const criteria = story.acceptanceCriteriaCount ?? story.acceptanceCriteria?.length ?? 0;
  const relations = story.relationshipCount ?? story.relationships?.length ?? 0;
  const blockers = (story.relationships || []).filter((item) => item.direction === "inward" && item.relation.toLowerCase().includes("blocked")).length;
  const priorityClass = story.priority ? `priority-${esc(story.priority)}` : "";
  const blocked = Boolean(story.impediment?.active);
  const blockedReason = blocked ? story.impediment?.reason || "Sem motivo informado." : "";
  const previous = lanes.find((lane) => lane.id === transitions.backward);
  const next = lanes.find((lane) => lane.id === transitions.forward);
  return `
    <article class="scrum-story-card" id="story_${esc(story.id)}" tabindex="0" draggable="true"
      ondragstart="startScrumStoryDrag(event,'${esc(story.id)}','${esc(story.laneId)}')" ondragend="endScrumStoryDrag()"
      onclick="openStoryDetailsById('${esc(story.id)}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openStoryDetailsById('${esc(story.id)}')}"
      aria-label="Abrir detalhes de ${esc(story.key)}">
      <div class="story-card-top">
        <div class="story-card-identifiers">
          <span class="story-key-badge">${esc(story.key)}</span>
          ${epic ? `<span class="story-epic-chip" style="--epic-color:${esc(epic.color || '#6366f1')}">${esc(epic.title)}</span>` : ""}
        </div>
        ${story.points !== null && story.points !== undefined ? `<span class="story-pts-badge">${esc(story.points)} pts</span>` : ""}
      </div>
      <div class="story-card-title">${esc(story.title)}</div>
      <div class="story-card-source-status">${icon("circle-dot")} ${esc(story.sourceStatus?.name || "Status local")}</div>
      <div class="story-card-foot">
        <div class="story-card-signals">
          ${blocked ? `<span class="story-impediment-badge" title="${esc(blockedReason)}">${icon("triangle-exclamation", "Impedida")}</span>` : ""}
          ${story.priority ? `<span class="${priorityClass}">${icon("flag")} ${esc(story.priority)}</span>` : ""}
          <span title="Criterios de aceite">${icon("list-check")} ${criteria}</span>
          ${blockers ? `<span title="Bloqueadores">${icon("ban")} ${blockers}</span>` : ""}
          ${relations ? `<span title="Dependencias e relacionamentos">${icon("link")} ${relations}</span>` : ""}
        </div>
        <div class="story-card-nav-btns" onclick="event.stopPropagation()">
          <button type="button" class="btn-step-col story-drag-handle" aria-label="Arrastar ${esc(story.key)} para outra etapa" title="Arrastar historia"><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button>
          <button type="button" class="btn-step-col" ${previous ? "" : "disabled"} onclick="moveScrumStoryByStep('${esc(story.id)}',-1)" aria-label="Mover ${esc(story.key)} para etapa anterior${previous ? `: ${esc(previous.name)}` : ""}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
          <button type="button" class="btn-step-col" ${next ? "" : "disabled"} onclick="moveScrumStoryByStep('${esc(story.id)}',1)" aria-label="Mover ${esc(story.key)} para proxima etapa${next ? `: ${esc(next.name)}` : ""}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
          <button type="button" class="btn-step-col story-impediment-toggle${blocked ? " is-blocked" : ""}" onclick="toggleStoryImpedimentById('${esc(story.id)}')" title="${blocked ? "Resolver impedimento" : "Marcar impedimento"}" aria-label="${blocked ? "Resolver impedimento" : "Marcar impedimento"}">${icon("triangle-exclamation")}</button>
          <button type="button" class="btn-step-col" onclick="openEditStoryById('${esc(story.id)}')" title="Editar historia" aria-label="Editar historia">${icon("pen")}</button>
          <button type="button" class="btn-step-col" onclick="sendStoryToChatById('${esc(story.id)}')" title="Enviar ao chat" aria-label="Enviar ao chat">${icon("message")}</button>
        </div>
      </div>
    </article>`;
}

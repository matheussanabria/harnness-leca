// @ts-check
// Painel lateral de leitura completa da historia, sem transformar leitura em edicao.
import { esc } from "../shared/dom.js";
import { md } from "../shared/markdown.js";
import { ds } from "./design-scrum-store.js";

function storyById(id) {
  return ds.currentScrumData?.stories?.find((story) => story.id === id || story.key === id);
}

function section(title, icon, body, count = null) {
  return `<section class="story-detail-section">
    <h3><i class="fa-solid fa-${icon}" aria-hidden="true"></i>${esc(title)}${count !== null ? `<span>${count}</span>` : ""}</h3>
    ${body}
  </section>`;
}

function criteriaHtml(items = []) {
  if (!items.length) return '<p class="story-detail-empty">Nao informado na documentacao.</p>';
  return items.map((item, index) => `<article class="story-detail-item">
    <strong>${esc(item.label || `Criterio ${index + 1}`)}</strong>
    <div class="story-detail-markdown">${md(item.content || String(item))}</div>
  </article>`).join("");
}

function scenariosHtml(items = []) {
  if (!items.length) return '<p class="story-detail-empty">Nenhum cenario documentado.</p>';
  return items.map((item) => `<details class="story-detail-scenario">
    <summary>${esc(item.title)}</summary><div class="story-detail-markdown">${md(item.content)}</div>
  </details>`).join("");
}

function relationshipsHtml(items = [], documentLinks = []) {
  if (!items.length && !documentLinks.length) return '<p class="story-detail-empty">Nenhum relacionamento no snapshot.</p>';
  return `<ul class="story-detail-relations">${items.map((item) => `<li>
    <span>${esc(item.relation)}</span>
    <button type="button" onclick="openStoryDetailsById('${esc(item.issue.key)}')">
      <b>${esc(item.issue.key)}</b> ${esc(item.issue.title)}
    </button>
  </li>`).join("")}${documentLinks.map((link) => `<li><span>documentacao</span><button type="button" onclick="openStoryDetailsById('${esc(link.key)}')"><b>${esc(link.key)}</b> ${esc(link.label)}</button></li>`).join("")}</ul>`;
}

function metadataHtml(story) {
  const epic = ds.currentScrumData?.epics?.find((item) => item.id === story.epicId);
  const rows = [
    ["Status Jira", story.sourceStatus?.name],
    ["Projeto", story.project?.name || story.project?.key],
    ["Coluna local", story.status],
    ["Tipo", story.issueType?.name],
    ["Epico", epic ? `${epic.id} - ${epic.title}` : story.epicId],
    ["Pontos", story.points],
    ["Prioridade", story.priority],
    ["Responsavel", story.assignee],
    ["Sprint", ds.currentScrumData?.sprints?.find((item) => item.id === story.sprintId)?.name],
    ["Criada em", story.createdAt],
    ["Atualizada em", story.updatedAt],
    ["Snapshot atualizado em", story.synchronization?.exportedAt],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return `<dl class="story-detail-metadata">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}

function transitionHistoryHtml(story) {
  const lanes = new Map((ds.currentScrumData?.lanes || []).map((lane) => [lane.id, lane.name]));
  const items = (ds.currentScrumData?.transitionHistory || [])
    .filter((item) => item.storyId === story.id || item.storyKey === story.key)
    .slice().reverse();
  if (!items.length) return '<p class="story-detail-empty">Nenhuma movimentacao registrada.</p>';
  return `<ol class="story-transition-history">${items.map((item) => `<li>
    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
    <span><b>${esc(lanes.get(item.fromLaneId) || item.fromLaneId)}</b> para <b>${esc(lanes.get(item.toLaneId) || item.toLaneId)}</b><small>${esc(item.occurredAt)}</small></span>
  </li>`).join("")}</ol>`;
}

function commentsHtml(items = []) {
  if (!items.length) return '<p class="story-detail-empty">Nenhum comentario registrado.</p>';
  return items.map((item, index) => {
    const author = item.author?.displayName || item.author?.name || item.author || `Autor ${index + 1}`;
    const date = item.created || item.updated || item.createdAt || "";
    return `<article class="story-detail-item story-comment-item">
      <div class="story-comment-header">
        <strong><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(author)}</strong>
        ${date ? `<small>${esc(date)}</small>` : ""}
      </div>
      <div class="story-detail-markdown">${md(item.body || item.content || String(item))}</div>
    </article>`;
  }).join("");
}

export function renderStoryDetails(story) {
  const sourceLabel = story.source === "jira-snapshot" ? "Jira + documentacao local" : "Historia local";
  return `<div class="story-drawer-head">
      <div><span class="story-key-badge">${esc(story.key)}</span><span class="story-source-badge">${esc(sourceLabel)}</span></div>
      <button type="button" class="story-drawer-close" onclick="closeStoryDetails()" aria-label="Fechar detalhes"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="story-drawer-scroll">
      <h2 id="storyDrawerTitle">${esc(story.title)}</h2>
      <div class="story-drawer-actions">
        <button type="button" class="btn-card-action" onclick="openEditStoryById('${esc(story.id)}')"><i class="fa-solid fa-pen"></i> Editar</button>
        <button type="button" class="btn-card-action" onclick="sendStoryToChatById('${esc(story.id)}')"><i class="fa-solid fa-message"></i> Enviar ao chat</button>
      </div>
      ${section("Metadados", "table-list", metadataHtml(story))}
      ${section("Historico de movimentacao", "clock-rotate-left", transitionHistoryHtml(story))}
      ${story.context ? section("Contexto", "circle-info", `<div class="story-detail-markdown">${md(story.context)}</div>`) : ""}
      ${section("Descricao", "align-left", story.description ? `<div class="story-detail-markdown">${md(story.description)}</div>` : '<p class="story-detail-empty">Nao informada.</p>')}
      ${story.userStory ? section("Historia de usuario", "id-card", `<div class="story-detail-markdown">${md(story.userStory)}</div>`) : ""}
      ${section("Criterios de aceite", "list-check", criteriaHtml(story.acceptanceCriteria), story.acceptanceCriteriaCount ?? story.acceptanceCriteria?.length ?? 0)}
      ${section("Cenarios automatizados", "flask", scenariosHtml(story.scenarios), story.scenarioCount ?? story.scenarios?.length ?? 0)}
      ${story.outOfScope ? section("Fora do escopo", "ban", `<div class="story-detail-markdown">${md(story.outOfScope)}</div>`) : ""}
      ${story.additionalInfo ? section("Informacoes adicionais", "asterisk", `<div class="story-detail-markdown">${md(story.additionalInfo)}</div>`) : ""}
      ${section("Relacionamentos", "link", relationshipsHtml(story.relationships, story.documentLinks), (story.relationshipCount ?? story.relationships?.length ?? 0) + (story.documentLinks?.length || 0))}
      ${section("Comentarios", "comments", commentsHtml(story.comments || []), story.comments?.length || 0)}
      ${story.attachments?.length ? section("Anexos", "paperclip", `<ul class="story-detail-attachments">${story.attachments.map((item) => `<li>${esc(item.filename || item.name || "Anexo")}</li>`).join("")}</ul>`, story.attachments.length) : ""}
      ${story.documentationFile ? `<p class="story-detail-source"><i class="fa-regular fa-file-lines"></i> ${esc(story.documentationFile)}</p>` : ""}
    </div>`;
}

export function registerStoryDrawer() {
  window.openStoryDetailsById = (id) => {
    const story = storyById(id);
    if (!story) return;
    ds.selectedStoryId = story.id;
    ds.storyDrawerReturnFocus = document.activeElement;
    const drawer = document.getElementById("scrumStoryDrawer");
    if (!drawer) return;
    drawer.innerHTML = renderStoryDetails(story);
    drawer.hidden = false;
    drawer.classList.add("is-open");
    drawer.querySelector(".story-drawer-close")?.focus();
  };
  window.closeStoryDetails = () => {
    const drawer = document.getElementById("scrumStoryDrawer");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.hidden = true;
    ds.storyDrawerReturnFocus?.focus?.();
  };
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("scrumStoryDrawer")?.hidden) window.closeStoryDetails();
  });
}

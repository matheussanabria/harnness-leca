// @ts-check
// Secao "Funcionalidades no mapa" do painel da historia: telas e campos que a historia e dona ou relacionada
// (vinculos do quadro original) e, recolhidas, as funcionalidades por documentacao. "Ver no mapa" abre a tela
// no Mapa em Camadas, com o campo em foco quando ha campo. Somente leitura.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";

export const FEATURES_BODY_ID = "storyFeaturesBody";

/** Ultima carga: respostas de uma historia antiga nao sobrescrevem a atual. */
let currentRequest = 0;

export function featuresSectionPlaceholder() {
  return `<div id="${FEATURES_BODY_ID}"><p class="story-detail-empty">Carregando funcionalidades...</p></div>`;
}

const GO_ICON = '<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>';

/** @param {any} item */
function otherStories(item) {
  const outras = (item.outras || []).map((o) => o.key);
  return outras.length ? `<span>tambem: ${esc(outras.join(", "))}</span>` : "";
}

/** Linha de uma funcionalidade documentada (por _status.md). */
function featureRow(item, related) {
  const screens = item.screens || [];
  const papel = related ? `<span class="chip-papel">${esc(item.papel)}</span>` : "";
  const screensLabel = screens.length ? `<span>${screens.length} ${screens.length === 1 ? "tela" : "telas"}</span>` : "";
  const links = screens.length
    ? screens.map((s) => `<button type="button" class="story-feature-go" data-screen-id="${esc(s.screenId)}" title="${esc(s.title)}">
        ${GO_ICON} Ver no mapa${screens.length > 1 ? `: ${esc(s.title)}` : ""}</button>`).join("")
    : '<span class="story-feature-none">sem mapa ainda</span>';
  return `<li class="story-feature">
      <div class="story-feature-main">
        <strong>${esc(item.title)}</strong>
        <span class="story-feature-meta"><code>${esc(item.slug)}</code>${papel}${screensLabel}${otherStories(item)}</span>
      </div>
      <div class="story-feature-links">${links}</div>
    </li>`;
}

/** Linha de um vinculo historia -> tela e campo do mapa. */
function fieldRow(item) {
  const where = item.screenId ? `<span>${esc(item.screenTitle)}${item.fieldLabel ? ` · ${esc(item.fieldLabel)}` : ""}</span>` : "";
  const validate = item.conferido ? "" : '<span class="chip-papel chip-validar">a validar</span>';
  const link = item.screenId
    ? `<button type="button" class="story-feature-go" data-screen-id="${esc(item.screenId)}" data-field-id="${esc(item.fieldId || "")}">${GO_ICON} Ver no mapa</button>`
    : '<span class="story-feature-none">sem mapa ainda</span>';
  return `<li class="story-feature">
      <div class="story-feature-main">
        ${item.grupo ? `<small class="story-feature-group">${esc(item.grupo)}</small>` : ""}
        <strong>${esc(item.rotulo)}</strong>
        <span class="story-feature-meta">${where}${validate}</span>
      </div>
      <div class="story-feature-links">${link}</div>
    </li>`;
}

function group(label, items, row) {
  return items.length
    ? `<h4 class="story-features-sub">${label} <span class="count">${items.length}</span></h4>
       <ul class="story-features">${items.map(row).join("")}</ul>`
    : "";
}

/**
 * @param {{ dona?: any[], relacionada?: any[], campos?: { dona?: any[], relacionada?: any[] } } | undefined} entry
 * @returns {string}
 */
export function featuresBodyHtml(entry) {
  const dona = entry?.dona || [];
  const relacionada = entry?.relacionada || [];
  const camposDona = entry?.campos?.dona || [];
  const camposRel = entry?.campos?.relacionada || [];
  if (!dona.length && !relacionada.length && !camposDona.length && !camposRel.length) {
    return '<p class="story-detail-empty">Nenhuma funcionalidade do mapa cita esta historia.</p>';
  }
  const docs = group("E dona de", dona, (i) => featureRow(i, false)) + group("Relacionada a", relacionada, (i) => featureRow(i, true));
  if (!camposDona.length && !camposRel.length) return docs;
  const fields = group("E dona de", camposDona, fieldRow) + group("Relacionada a", camposRel, fieldRow);
  const total = dona.length + relacionada.length;
  return fields + (total ? `<details class="story-features-docs"><summary>Documentacao por funcionalidade (${total})</summary>${docs}</details>` : "");
}

/** Abre a tela (e o campo, se houver) no Mapa em Camadas (usa o ouvinte de design.js). */
function openOnMap(screenId, fieldId) {
  window.closeStoryDetails?.();
  window.dispatchEvent(new CustomEvent("harness:open-layer-target", { detail: { route: screenId, screenId, fieldId: fieldId || undefined } }));
}

/**
 * @param {ParentNode} root painel que contem o corpo da secao
 * @param {{ key?: string, id: string }} story
 */
export async function loadStoryFeatures(root, story) {
  const body = root.querySelector(`#${FEATURES_BODY_ID}`);
  if (!body) return;
  const request = ++currentRequest;
  const slug = state.P?.name || state.S?.active;
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(slug)}/design/story-features`);
    const data = await response.json();
    if (request !== currentRequest) return;
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    body.innerHTML = featuresBodyHtml(data.stories?.[story.key || ""]);
    body.querySelectorAll("[data-screen-id]").forEach((button) => {
      button.addEventListener("click", () => openOnMap(button.getAttribute("data-screen-id") || "", button.getAttribute("data-field-id") || ""));
    });
  } catch (error) {
    if (request !== currentRequest) return;
    body.innerHTML = `<p class="story-detail-empty">Nao foi possivel carregar: ${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

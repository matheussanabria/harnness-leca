// @ts-check
// Secao "Funcionalidades no mapa" do painel da historia: funcionalidades que a historia e dona
// ou relacionada, cada uma com "Ver no mapa" que abre a tela no Mapa em Camadas. Somente leitura.
import { esc } from "../shared/dom.js";
import { state } from "../shared/state.js";

export const FEATURES_BODY_ID = "storyFeaturesBody";

/** Ultima carga: respostas de uma historia antiga nao sobrescrevem a atual. */
let currentRequest = 0;

export function featuresSectionPlaceholder() {
  return `<div id="${FEATURES_BODY_ID}"><p class="story-detail-empty">Carregando funcionalidades...</p></div>`;
}

/** @param {any} item */
function otherStories(item) {
  const outras = (item.outras || []).map((o) => o.key);
  return outras.length ? `<span>tambem: ${esc(outras.join(", "))}</span>` : "";
}

/** @param {any} item */
function featureRow(item, related) {
  const screens = item.screens || [];
  const papel = related ? `<span class="chip-papel">${esc(item.papel)}</span>` : "";
  const screensLabel = screens.length ? `<span>${screens.length} ${screens.length === 1 ? "tela" : "telas"}</span>` : "";
  const links = screens.length
    ? screens.map((s) => `<button type="button" class="story-feature-go" data-screen-id="${esc(s.screenId)}" title="${esc(s.title)}">
        <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> Ver no mapa${screens.length > 1 ? `: ${esc(s.title)}` : ""}</button>`).join("")
    : '<span class="story-feature-none">sem mapa ainda</span>';
  return `<li class="story-feature">
      <div class="story-feature-main">
        <strong>${esc(item.title)}</strong>
        <span class="story-feature-meta"><code>${esc(item.slug)}</code>${papel}${screensLabel}${otherStories(item)}</span>
      </div>
      <div class="story-feature-links">${links}</div>
    </li>`;
}

/**
 * @param {{ dona?: any[], relacionada?: any[] } | undefined} entry
 * @returns {string}
 */
export function featuresBodyHtml(entry) {
  const dona = entry?.dona || [];
  const relacionada = entry?.relacionada || [];
  if (!dona.length && !relacionada.length) {
    return '<p class="story-detail-empty">Nenhuma funcionalidade do mapa cita esta historia.</p>';
  }
  const group = (label, items, related) => items.length
    ? `<h4 class="story-features-sub">${label} <span class="count">${items.length}</span></h4>
       <ul class="story-features">${items.map((i) => featureRow(i, related)).join("")}</ul>`
    : "";
  return group("E dona de", dona, false) + group("Relacionada a", relacionada, true);
}

/** Abre a tela no Mapa em Camadas (usa o ouvinte de design.js). */
function openOnMap(screenId) {
  window.closeStoryDetails?.();
  window.dispatchEvent(new CustomEvent("harness:open-layer-target", { detail: { route: screenId, screenId } }));
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
      button.addEventListener("click", () => openOnMap(button.getAttribute("data-screen-id") || ""));
    });
  } catch (error) {
    if (request !== currentRequest) return;
    body.innerHTML = `<p class="story-detail-empty">Nao foi possivel carregar: ${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

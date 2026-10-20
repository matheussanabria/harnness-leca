// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";

/**
 * Renderiza a navegação por etapas do fluxo de negócio.
 * @param {any[]} screens
 * @returns {string}
 */
export function renderStagesNav(screens) {
  if (!screens || screens.length === 0) return "";

  const pills = screens.map((s, idx) => {
    const isActive = s.id === dls.activeScreenId;
    const fieldCount = s.fields?.length || 0;
    const route = s.route || "";

    const stageLabel = s.short || s.title;

    return `
      <button type="button" class="stage-nav-pill ${isActive ? 'active' : ''}" onclick="selectActiveScreen('${esc(s.id)}')" aria-current="${isActive ? 'step' : 'false'}" title="${esc(s.title || '')}">
        <span class="stage-pill-title">${esc(stageLabel)}</span>
        <span class="stage-pill-badge" title="${fieldCount} elementos mapeados">${fieldCount}</span>
      </button>
    `;
  }).join("");

  return `
    <div class="stages-nav-wrapper">
      <div class="stages-nav-label">
        <i class="fa-solid fa-arrow-right-arrow-left"></i> <span>Etapas do Fluxo:</span>
      </div>
      <div class="stages-nav-scroll">
        ${pills}
      </div>
    </div>
  `;
}

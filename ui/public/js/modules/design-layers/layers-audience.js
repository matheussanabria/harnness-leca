// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { AUDIENCES, getAudience } from "./layers-audience-profiles.js";

/**
 * Renderiza o seletor "Quem está olhando" que controla as camadas visíveis.
 * @returns {string}
 */
export function renderAudienceSelector() {
  const cur = getAudience(dls.activeAudience || "all").id;
  const btns = AUDIENCES.map((a) => `
    <button type="button" class="audience-btn ${a.id === cur ? "active" : ""}" onclick="setLayersAudience('${esc(a.id)}')" aria-pressed="${a.id === cur}">
      <span class="audience-title">${esc(a.title)}</span>
      <span class="audience-subtitle">${esc(a.subtitle)}</span>
    </button>`).join("");
  return `
    <div class="layers-audience-bar" role="group" aria-label="Quem está olhando">
      <span class="audience-label"><i class="fa-solid fa-eye"></i> Quem está olhando</span>
      <div class="audience-options">${btns}</div>
    </div>`;
}

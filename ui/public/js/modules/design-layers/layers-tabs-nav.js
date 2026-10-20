// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { LAYERS_NAV } from "./layers-state.js";

/**
 * Renderiza as 6 abas de navegação por camadas com título, subtítulo e destaque ativo.
 * @param {any} sc
 * @returns {string}
 */
export function renderLayersTabsNav(sc) {
  const curLayer = dls.activeLayer || "ui";

  const getLayerCount = (layerId) => {
    if (!sc) return 0;
    switch (layerId) {
      case "ui": return sc.fields?.length || 0;
      case "rules": return sc.rules?.length || 0;
      case "api": return sc.endpoints?.length || 0;
      case "data": return sc.entities?.length || 0;
      case "tests": return (sc.tests?.groups || []).reduce((acc, g) => acc + (g.cases?.length || 0), 0) || (sc.tests?.groups?.length || 0);
      case "legacy": return sc.legacy?.length || 0;
      default: return 0;
    }
  };

  const tabsHtml = LAYERS_NAV.map((l) => {
    const isActive = l.id === curLayer;
    const count = getLayerCount(l.id);

    return `
      <button type="button" class="layer-tab-btn ${isActive ? 'active' : ''}" onclick="setLayerTab('${esc(l.id)}')" role="tab" aria-selected="${isActive}">
        <div class="layer-tab-head">
          <span class="layer-tab-num">${l.num}</span>
          <span class="layer-tab-title">${esc(l.title)}</span>
          <span class="layer-tab-count">${count}</span>
        </div>
        <div class="layer-tab-subtitle">${esc(l.subtitle)}</div>
      </button>
    `;
  }).join("");

  return `
    <div class="layers-tabs-nav" role="tablist" aria-label="Camadas Técnicas">
      ${tabsHtml}
    </div>
  `;
}

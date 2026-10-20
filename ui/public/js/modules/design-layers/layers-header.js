// @ts-check
import { esc } from "../../shared/dom.js";
import { dls } from "../design-layers-store.js";
import { STATUS_MAP, LEGACY_PARITY_MAP, calculateStatusMetrics } from "./layers-state.js";

/**
 * Renderiza o cabeçalho completo do módulo de Telas em Camadas.
 * @param {any} sc
 * @returns {string}
 */
export function renderLayersModuleHeader(sc) {
  const metrics = calculateStatusMetrics(sc);
  const curVp = dls.activeViewport || "desktop";

  // Segmentos da barra horizontal proporcional
  const segmentsHtml = metrics.map((m) => `
    <div class="status-segment" style="width:${m.pct}%;background:${m.color}" title="${esc(m.label)}: ${m.count} (${m.pct}%)"></div>
  `).join("");

  // Badges da legenda de status
  const statusLegendHtml = Object.entries(STATUS_MAP)
    .filter(([k]) => k !== "pend")
    .map(([_, v]) => `
      <div class="legend-chip">
        <span class="legend-dot" style="background:${v.color}"></span>
        <span>${esc(v.label)}</span>
      </div>
    `).join("");

  // Badges da legenda de legado
  const legacyLegendHtml = Object.values(LEGACY_PARITY_MAP).map((v) => `
    <div class="legend-chip">
      <span class="legend-badge-text" style="color:${v.color};border-color:${v.color}">${esc(v.badge)}</span>
      <span>${esc(v.label)}</span>
    </div>
  `).join("");

  return `
    <div class="dis-module-header">
      <div class="dis-header-top">
        <div class="dis-title-block">
          <div class="dis-title-row">
            <span class="dis-badge-tag"><i class="fa-solid fa-layer-group"></i> DIS</span>
            <h1 class="dis-main-title">Telas em camadas</h1>
          </div>
          <p class="dis-subtitle">
            Rastreamento técnico de ponta a ponta: Tela ↔ Regras ↔ Endpoints ↔ Banco de Dados ↔ Testes e BDD ↔ Legado.
          </p>
        </div>

        <div class="dis-header-controls">
          <div class="dis-viewport-selector" role="group" aria-label="Visualização de tela">
            <button type="button" class="btn-dis-vp ${curVp === 'desktop' ? 'active' : ''}" onclick="setLayersViewport('desktop')" title="Visualização Desktop em 2 colunas">
              <i class="fa-solid fa-display"></i> <span>Desktop</span>
            </button>
            <button type="button" class="btn-dis-vp ${curVp === 'tablet' ? 'active' : ''}" onclick="setLayersViewport('tablet')" title="Visualização Tablet">
              <i class="fa-solid fa-tablet-screen-button"></i> <span>Tablet</span>
            </button>
            <button type="button" class="btn-dis-vp ${curVp === 'mobile' ? 'active' : ''}" onclick="setLayersViewport('mobile')" title="Visualização Celular">
              <i class="fa-solid fa-mobile-screen-button"></i> <span>Mobile</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra de Situação Proporcional -->
      <div class="dis-metrics-bar-wrap">
        <div class="dis-metrics-info">
          <span class="metrics-label"><i class="fa-solid fa-chart-simple"></i> Indicadores de Situação da Etapa</span>
          <div class="metrics-tags">
            ${metrics.map((m) => `<span class="metrics-pill" style="color:${m.color}"><b>${m.count}</b> ${esc(m.label)}</span>`).join("")}
          </div>
        </div>
        <div class="dis-metrics-progress">
          ${segmentsHtml || '<div class="status-segment" style="width:100%;background:#334155"></div>'}
        </div>
      </div>

      <!-- Barra de Legendas -->
      <div class="dis-legends-strip">
        <div class="legend-group">
          <span class="legend-group-title">Status:</span>
          ${statusLegendHtml}
        </div>
        <div class="legend-divider"></div>
        <div class="legend-group">
          <span class="legend-group-title">Legado:</span>
          ${legacyLegendHtml}
        </div>
      </div>
    </div>
  `;
}
